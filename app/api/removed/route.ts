import { NextRequest, NextResponse, connection } from "next/server";
import { getSql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const PAGE = 50;

// Farmers who were removed, with the reason. Admins only. This never holds
// names or phone numbers, because those are deleted for good on removal.
export async function GET(request: NextRequest) {
  await connection();
  const auth = await requireUser(request, ["admin"]);
  if ("response" in auth) return auth.response;

  const beforeRaw = new URL(request.url).searchParams.get("before") ?? "";
  const before = /^\d{1,18}$/.test(beforeRaw) ? beforeRaw : "";

  try {
    const sql = getSql();
    const [rows, summary] = await Promise.all([
      sql`
        select d.id::text as id, d.farmer_id::text as farmer_id, d.village,
               d.primary_crop, d.farm_size_hectares::float8 as farm_size_hectares,
               d.farmer_created_at, d.reason, d.note, d.deleted_at,
               u.display_name as removed_by
        from deletion_log d
        left join users u on u.id = d.deleted_by
        where (${before}::text = '' or d.id < ${before}::text::bigint)
        order by d.id desc
        limit ${PAGE + 1}::int`,
      sql`
        select reason, count(*)::int as n
        from deletion_log
        group by reason
        order by count(*) desc, reason`,
    ]);
    const items = rows.slice(0, PAGE);
    const nextBefore = rows.length > PAGE ? items[items.length - 1].id : null;
    return NextResponse.json({ items, nextBefore, summary });
  } catch (err) {
    console.error("GET /api/removed failed:", err);
    return NextResponse.json({ error: "Could not load removed farmers" }, { status: 500 });
  }
}
