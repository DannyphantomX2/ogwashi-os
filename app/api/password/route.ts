import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  clientIp,
  createSessionToken,
  requireUser,
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logActivity } from "@/lib/activity";

const MAX_FAILS = 10; // wrong "current password" guesses per 15 minutes

export async function POST(request: NextRequest) {
  // Also open to people on a temporary password: this is how they leave it
  const auth = await requireUser(request, undefined, { allowMustChange: true });
  if ("response" in auth) return auth.response;
  const user = auth.user;
  const ip = clientIp(request);

  let currentPassword = "";
  let newPassword = "";
  try {
    const body = await request.json();
    if (typeof body?.currentPassword === "string") {
      currentPassword = body.currentPassword.slice(0, 200);
    }
    if (typeof body?.newPassword === "string") {
      newPassword = body.newPassword.slice(0, 200);
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const errors: Record<string, string> = {};
  if (!currentPassword) errors.currentPassword = "Enter your current password";
  if (newPassword.length < 10) {
    errors.newPassword = "Use at least 10 characters";
  } else if (newPassword.toLowerCase() === user.username.toLowerCase()) {
    errors.newPassword = "Do not use your username as your password";
  } else if (newPassword === currentPassword) {
    errors.newPassword = "Choose a different password from the current one";
  }
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    const sql = getSql();
    const name = user.username.toLowerCase();

    // Someone holding a stolen session should not be able to guess the
    // current password without limit, so this shares the login lockout
    const [counts] = await sql`
      select count(*)::int as fails from login_attempts
      where username = ${name}::text and attempted_at > now() - interval '15 minutes'`;
    if (counts.fails >= MAX_FAILS) {
      return NextResponse.json(
        { error: "Too many wrong attempts. Try again in 15 minutes." },
        { status: 429 }
      );
    }

    const rows = await sql`select password_hash from users where id = ${user.id}::bigint`;
    const ok = await verifyPassword(currentPassword, rows[0]?.password_hash ?? null);
    if (!ok) {
      await sql`insert into login_attempts (ip, username) values (${ip}, ${name}::text)`;
      await logActivity({ user, action: "password.change_failed", ip });
      return NextResponse.json(
        { errors: { currentPassword: "That is not your current password" } },
        { status: 400 }
      );
    }

    const hash = await hashPassword(newPassword);
    // One statement: change the password, end older sessions, write the log
    const updated = await sql`
      with updated as (
        update users
        set password_hash = ${hash}, must_change_password = false,
            session_version = session_version + 1
        where id = ${user.id}::bigint
        returning id, username, session_version
      ), audit as (
        insert into activity_log (user_id, username, action, details, ip)
        select id, username, 'user.password_change',
               jsonb_build_object('by', 'self'), ${ip}::text
        from updated
      )
      select session_version from updated`;
    if (updated.length === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // The change ended this browser's old session, so give it a fresh one
    const res = NextResponse.json({ ok: true });
    res.cookies.set(
      SESSION_COOKIE,
      createSessionToken(user.id, Number(updated[0].session_version)),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_MAX_AGE,
      }
    );
    return res;
  } catch (err) {
    console.error("POST /api/password failed:", err);
    return NextResponse.json({ error: "Could not change password" }, { status: 500 });
  }
}
