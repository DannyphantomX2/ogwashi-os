import { NextRequest, NextResponse } from "next/server";
import { getSql, isTransientDbError } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  clientIp,
  createSessionToken,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { logActivity } from "@/lib/activity";

const MAX_IP_FAILS = 8; // failed attempts per IP address per 15 minutes
const MAX_USER_FAILS = 10; // failed attempts per account per 15 minutes

// Bookkeeping (counting failed attempts, tidying old ones) must never decide
// whether someone gets in. If it fails, note it and carry on.
async function bestEffort(label: string, work: () => Promise<unknown>) {
  try {
    await work();
  } catch (err) {
    console.error(`Login bookkeeping failed (${label}):`, err);
  }
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  let username = "";
  let password = "";
  let portal: "admin" | "agent" | null = null;
  try {
    const body = await request.json();
    if (typeof body?.username === "string") {
      username = body.username.trim().toLowerCase().slice(0, 50);
    }
    if (typeof body?.password === "string") {
      password = body.password.slice(0, 200);
    }
    if (body?.as === "admin" || body?.as === "agent") portal = body.as;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!username || !password) {
    return NextResponse.json(
      { error: "Enter your username and password" },
      { status: 400 }
    );
  }

  try {
    const sql = getSql();

    // Step 1: the two reads. These are retried automatically. If they still
    // fail, say so clearly instead of a vague "unavailable".
    let counts: { ip_fails: number; user_fails: number };
    let row: Record<string, any> | undefined;
    try {
      [counts] = await sql`
        select count(*) filter (where ip = ${ip})::int as ip_fails,
               count(*) filter (where username = ${username}::text)::int as user_fails
        from login_attempts
        where attempted_at > now() - interval '15 minutes'
          and (ip = ${ip} or username = ${username}::text)` as unknown as [
        { ip_fails: number; user_fails: number },
      ];
      const rows = await sql`
        select id::text as id, username, display_name, role, password_hash, active,
               session_version
        from users
        where lower(username) = ${username}::text
        limit 1`;
      row = rows[0];
    } catch (err) {
      console.error("POST /api/login could not read from the database:", err);
      if (isTransientDbError(err)) {
        return NextResponse.json(
          {
            error: "Can't reach the database right now. Wait a few seconds and try again.",
            code: "db_unavailable",
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "Login is unavailable right now" },
        { status: 500 }
      );
    }

    if (counts.ip_fails >= MAX_IP_FAILS || counts.user_fails >= MAX_USER_FAILS) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429 }
      );
    }

    const passwordOk = await verifyPassword(password, row?.password_hash ?? null);

    if (!row || !row.active || !passwordOk) {
      // Only store the typed username if it is a real account. People
      // sometimes type their password into the username box.
      const known: string | null = row ? String(row.username).toLowerCase() : null;
      await bestEffort("record failed attempt", async () => {
        await sql`insert into login_attempts (ip, username) values (${ip}, ${known}::text)`;
      });
      await bestEffort("tidy old attempts", async () => {
        await sql`delete from login_attempts where attempted_at < now() - interval '1 day'`;
      });
      await logActivity({
        username: known,
        action: "login.failed",
        details: !row
          ? { reason: "unknown username" }
          : !row.active
            ? { reason: "account disabled" }
            : { reason: "wrong password" },
        ip,
      });
      if (
        counts.ip_fails + 1 === MAX_IP_FAILS ||
        (known && counts.user_fails + 1 === MAX_USER_FAILS)
      ) {
        await logActivity({ username: known, action: "login.locked", ip });
      }
      return NextResponse.json(
        { error: "Wrong username or password" },
        { status: 401 }
      );
    }

    await bestEffort("clear old failed attempts", async () => {
      await sql`delete from login_attempts where username = ${username}::text`;
    });

    const user = {
      id: row.id as string,
      username: row.username as string,
      displayName: row.display_name as string,
      role: row.role as "admin" | "agent",
    };

    // The login screen has an Admin tab and an Agent tab. The account decides
    // the real role; this only stops someone using the wrong door by mistake.
    // It is checked after the password, so it reveals nothing to a guesser.
    if (portal && user.role !== portal) {
      await logActivity({
        user,
        action: "login.wrong_portal",
        details: { tried: portal, role: user.role },
        ip,
      });
      return NextResponse.json(
        {
          error: `This is ${user.role === "admin" ? "an admin" : "an agent"} account. Use ${user.role === "admin" ? "Admin" : "Agent"} login.`,
          role: user.role,
        },
        { status: 403 }
      );
    }

    await logActivity({ user, action: "login.success", ip });

    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.id, Number(row.session_version)), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (err) {
    // Anything else, such as a missing SESSION_SECRET. The cause is in the log.
    console.error("POST /api/login failed:", err);
    return NextResponse.json(
      { error: "Login is unavailable right now" },
      { status: 500 }
    );
  }
}
