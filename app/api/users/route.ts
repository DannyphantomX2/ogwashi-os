import { NextRequest, NextResponse, connection } from "next/server";
import { getSql } from "@/lib/db";
import { clientIp, requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { generateTempPassword } from "@/lib/tempPassword";

const USERNAME = /^[a-z0-9._-]{3,30}$/;

export async function GET(request: NextRequest) {
  await connection();
  const auth = await requireUser(request, ["admin"]);
  if ("response" in auth) return auth.response;
  try {
    const sql = getSql();
    const users = await sql`
      select u.id::text as id, u.username, u.display_name, u.role, u.active,
             u.must_change_password, u.created_at,
             (select max(a.at) from activity_log a
              where a.user_id = u.id and a.action = 'login.success') as last_login
      from users u
      order by u.created_at`;
    return NextResponse.json({ users });
  } catch (err) {
    console.error("GET /api/users failed:", err);
    return NextResponse.json({ error: "Could not load the team" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request, ["admin"]);
  if ("response" in auth) return auth.response;
  const admin = auth.user;
  const ip = clientIp(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >;

  const username =
    typeof b.username === "string" ? b.username.trim().toLowerCase() : "";
  const displayName =
    typeof b.displayName === "string"
      ? b.displayName.trim().replace(/\s+/g, " ")
      : "";
  const role = b.role === "admin" || b.role === "agent" ? b.role : null;

  const errors: Record<string, string> = {};
  if (!USERNAME.test(username)) {
    errors.username =
      "3 to 30 characters: lowercase letters, numbers, dot, dash or underscore";
  }
  if (displayName.length < 2 || displayName.length > 60) {
    errors.displayName = "Enter the person's name (2 to 60 characters)";
  }
  if (!role) errors.role = "Choose Agent or Admin";
  if (Object.keys(errors).length > 0 || !role) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  // The admin never chooses the password. A random one is made here, shown
  // once, and the person must replace it at their first login.
  const temporaryPassword = generateTempPassword();

  try {
    const hash = await hashPassword(temporaryPassword);
    const sql = getSql();
    const rows = await sql`
      with created as (
        insert into users (username, display_name, role, password_hash, must_change_password)
        values (${username}, ${displayName}, ${role}, ${hash}, true)
        returning id, username, display_name, role, active,
                  must_change_password, created_at
      ), audit as (
        insert into activity_log (user_id, username, action, details, ip)
        select ${admin.id}::bigint, ${admin.username}::text, 'user.create',
               jsonb_build_object('target', username, 'role', role),
               ${ip}::text
        from created
      )
      select id::text as id, username, display_name, role, active,
             must_change_password, created_at
      from created`;
    return NextResponse.json(
      { user: rows[0], temporaryPassword },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json(
        { errors: { username: "That username is already taken" } },
        { status: 409 }
      );
    }
    console.error("POST /api/users failed:", err);
    return NextResponse.json({ error: "Could not create the account" }, { status: 500 });
  }
}
