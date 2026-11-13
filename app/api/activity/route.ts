import { NextRequest, NextResponse, connection } from "next/server";
import { getSql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const GROUPS = new Set(["all", "logins", "farmers", "team", "alerts"]);
const PAGE = 50;

// The activity log, newest first, 50 at a time. Admins only.
export async function GET(request: NextRequest) {
  await connection();
  const auth = await requireUser(request, ["admin"]);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const groupRaw = searchParams.get("group") ?? "all";
  const group = GROUPS.has(groupRaw) ? groupRaw : "all";
  const beforeRaw = searchParams.get("before") ?? "";
  const before = /^\d{1,18}$/.test(beforeRaw) ? beforeRaw : "";
  const personRaw = (searchParams.get("person") ?? "").toLowerCase();
  const person = /^[a-z0-9._-]{1,30}$/.test(personRaw) ? personRaw : "";

  try {
    const sql = getSql();
    const rows = await sql`
      select a.id::text as id, a.at, a.username, u.display_name, a.action,
             a.farmer_id::text as farmer_id, a.details, a.ip
      from activity_log a
      left join users u on u.id = a.user_id
      where (${before}::text = '' or a.id < ${before}::text::bigint)
        and (
          ${group}::text = 'all'
          or (${group}::text = 'logins' and (a.action like 'login.%' or a.action = 'logout'))
          or (${group}::text = 'farmers' and a.action like 'farmer.%')
          or (${group}::text = 'team' and (a.action like 'user.%' or a.action like 'password.%'))
          or (${group}::text = 'alerts' and a.action in ('export.csv', 'access.denied'))
        )
        and (${person}::text = '' or a.username = ${person}::text)
      order by a.id desc
      limit ${PAGE + 1}::int`;
    const items = rows.slice(0, PAGE);
    const nextBefore = rows.length > PAGE ? items[items.length - 1].id : null;
    return NextResponse.json({ items, nextBefore });
  } catch (err) {
    console.error("GET /api/activity failed:", err);
    return NextResponse.json({ error: "Could not load the activity log" }, { status: 500 });
  }
}
