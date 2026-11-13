import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { clientIp, requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { generateTempPassword } from "@/lib/tempPassword";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(request, ["admin"]);
  if ("response" in auth) return auth.response;
  const admin = auth.user;

  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = (body as { action?: unknown } | null)?.action;
  if (action !== "disable" && action !== "enable" && action !== "reset_password") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // An admin cannot lock themselves out. Use "Change password" for your own.
  if (id === admin.id && action !== "enable") {
    return NextResponse.json(
      { error: "You cannot do that to your own account here." },
      { status: 400 }
    );
  }

  const ip = clientIp(request);
  const sql = getSql();

  try {
    if (action === "reset_password") {
      const temporaryPassword = generateTempPassword();
      const hash = await hashPassword(temporaryPassword);
      const rows = await sql`
        with updated as (
          update users
          set password_hash = ${hash}, must_change_password = true,
              session_version = session_version + 1
          where id = ${id}::bigint
          returning id, username
        ), audit as (
          insert into activity_log (user_id, username, action, details, ip)
          select ${admin.id}::bigint, ${admin.username}::text, 'user.password_reset',
                 jsonb_build_object('target', username), ${ip}::text
          from updated
        )
        select username from updated`;
      if (rows.length === 0) {
        return NextResponse.json({ error: "Person not found" }, { status: 404 });
      }
      return NextResponse.json(
        { ok: true, temporaryPassword },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const active = action === "enable";
    const rows = await sql`
      with updated as (
        update users set active = ${active}::boolean
        where id = ${id}::bigint
        returning id, username
      ), audit as (
        insert into activity_log (user_id, username, action, details, ip)
        select ${admin.id}::bigint, ${admin.username}::text, ${
          active ? "user.enable" : "user.disable"
        }::text,
               jsonb_build_object('target', username), ${ip}::text
        from updated
      )
      select username from updated`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/users/[id] failed:", err);
    return NextResponse.json({ error: "That did not work. Try again." }, { status: 500 });
  }
}
