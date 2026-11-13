import { NextRequest, NextResponse, connection } from "next/server";
import { getSql } from "@/lib/db";
import { validateFarmer } from "@/lib/farmers";
import { clientIp, requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  await connection();
  const auth = await requireUser(request);
  if ("response" in auth) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim().slice(0, 100);
    const digits = q.replace(/\D/g, "").replace(/^0/, "");
    const phoneQ = digits.length >= 3 ? digits : "";
    const village = searchParams.get("village") ?? "";
    const crop = searchParams.get("crop") ?? "";

    const sql = getSql();
    const farmers = await sql`
      select id::text as id, full_name, phone, village, primary_crop,
             farm_size_hectares::float8 as farm_size_hectares,
             gps_lat, gps_lng, created_at
      from farmers
      where (
        ${q}::text = ''
        or full_name ilike '%' || ${q}::text || '%'
        or village ilike '%' || ${q}::text || '%'
        or (${phoneQ}::text <> '' and phone like '%' || ${phoneQ}::text || '%')
      )
      and (${village}::text = '' or village = ${village}::text)
      and (${crop}::text = '' or primary_crop = ${crop}::text)
      order by created_at desc
      limit 500`;
    return NextResponse.json({ farmers });
  } catch (err) {
    console.error("GET /api/farmers failed:", err);
    return NextResponse.json({ error: "Could not load farmers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("response" in auth) return auth.response;
  const user = auth.user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = validateFarmer(body);
  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }
  const f = result.data;
  const ip = clientIp(request);

  try {
    const sql = getSql();
    // One statement: save the farmer and write the activity log entry together
    const rows = await sql`
      with new_farmer as (
        insert into farmers
          (full_name, phone, village, primary_crop, farm_size_hectares,
           gps_lat, gps_lng, created_by)
        values
          (${f.full_name}, ${f.phone}, ${f.village}, ${f.primary_crop},
           ${f.farm_size_hectares}, ${f.gps_lat}, ${f.gps_lng}, ${user.id}::bigint)
        returning id, full_name, phone, village, primary_crop,
                  farm_size_hectares, gps_lat, gps_lng, created_at
      ), audit as (
        insert into activity_log (user_id, username, action, farmer_id, details, ip)
        select ${user.id}::bigint, ${user.username}::text, 'farmer.create', id,
               jsonb_build_object('village', village, 'crop', primary_crop,
                                  'farm_size_hectares', farm_size_hectares,
                                  'has_gps', gps_lat is not null),
               ${ip}::text
        from new_farmer
      )
      select id::text as id, full_name, phone, village, primary_crop,
             farm_size_hectares::float8 as farm_size_hectares,
             gps_lat, gps_lng, created_at
      from new_farmer`;
    return NextResponse.json({ farmer: rows[0] }, { status: 201 });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json(
        { errors: { phone: "A farmer with this phone number already exists" } },
        { status: 409 }
      );
    }
    console.error("POST /api/farmers failed:", err);
    return NextResponse.json({ error: "Could not save farmer" }, { status: 500 });
  }
}
