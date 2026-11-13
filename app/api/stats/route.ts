import { NextRequest, NextResponse, connection } from "next/server";
import { getSql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  await connection();
  const auth = await requireUser(request);
  if ("response" in auth) return auth.response;
  try {
    const sql = getSql();
    const [totals, byCrop, byVillage] = await Promise.all([
      sql`select count(*)::int as total,
                 coalesce(sum(farm_size_hectares), 0)::float8 as total_hectares
          from farmers`,
      sql`select primary_crop, count(*)::int as farmers,
                 coalesce(sum(farm_size_hectares), 0)::float8 as hectares
          from farmers
          group by primary_crop
          order by count(*) desc, primary_crop`,
      sql`select village, count(*)::int as farmers,
                 coalesce(sum(farm_size_hectares), 0)::float8 as hectares
          from farmers
          group by village
          order by count(*) desc, village`,
    ]);
    return NextResponse.json({
      total: totals[0].total,
      total_hectares: totals[0].total_hectares,
      by_crop: byCrop,
      by_village: byVillage,
    });
  } catch (err) {
    console.error("GET /api/stats failed:", err);
    return NextResponse.json({ error: "Could not load stats" }, { status: 500 });
  }
}
