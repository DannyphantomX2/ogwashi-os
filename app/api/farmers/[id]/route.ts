import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { clientIp, requireUser } from "@/lib/auth";
import { validateFarmer } from "@/lib/farmers";

// Replace a farmer's details. Agents and admins can both do this.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(request);
  if ("response" in auth) return auth.response;
  const user = auth.user;

  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) {
    return NextResponse.json({ error: "Invalid farmer id" }, { status: 400 });
  }

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
    // One statement: compare with what is saved, update only if something
    // changed, and write the activity log entry. Names and phone numbers are
    // never copied into the log, only which fields changed (plus before and
    // after for village, crop and farm size, which are not personal data).
    const rows = await sql`
      with old as (
        select id, full_name, phone, village, primary_crop, farm_size_hectares,
               gps_lat, gps_lng, created_at
        from farmers where id = ${id}::bigint
      ), changed as (
        select o.id from old o
        where (o.full_name, o.phone, o.village, o.primary_crop,
               o.farm_size_hectares, o.gps_lat, o.gps_lng)
              is distinct from
              (${f.full_name}::text, ${f.phone}::text, ${f.village}::text,
               ${f.primary_crop}::text, round(${f.farm_size_hectares}::numeric, 2),
               ${f.gps_lat}::float8, ${f.gps_lng}::float8)
      ), updated as (
        update farmers x
        set full_name = ${f.full_name}::text, phone = ${f.phone}::text,
            village = ${f.village}::text, primary_crop = ${f.primary_crop}::text,
            farm_size_hectares = round(${f.farm_size_hectares}::numeric, 2),
            gps_lat = ${f.gps_lat}::float8, gps_lng = ${f.gps_lng}::float8,
            updated_at = now(), updated_by = ${user.id}::bigint
        from changed c
        where x.id = c.id
        returning x.id, x.full_name, x.phone, x.village, x.primary_crop,
                  x.farm_size_hectares, x.gps_lat, x.gps_lng, x.created_at
      ), audit as (
        insert into activity_log (user_id, username, action, farmer_id, details, ip)
        select ${user.id}::bigint, ${user.username}::text, 'farmer.update', u.id,
               jsonb_strip_nulls(jsonb_build_object(
                 'fields', to_jsonb(array_remove(array[
                   case when o.full_name is distinct from u.full_name then 'name' end,
                   case when o.phone is distinct from u.phone then 'phone' end,
                   case when o.village is distinct from u.village then 'village' end,
                   case when o.primary_crop is distinct from u.primary_crop then 'crop' end,
                   case when o.farm_size_hectares is distinct from u.farm_size_hectares then 'farm_size' end,
                   case when (o.gps_lat, o.gps_lng) is distinct from (u.gps_lat, u.gps_lng) then 'gps' end
                 ], null)),
                 'village', case when o.village is distinct from u.village
                                 then jsonb_build_object('from', o.village, 'to', u.village) end,
                 'crop', case when o.primary_crop is distinct from u.primary_crop
                              then jsonb_build_object('from', o.primary_crop, 'to', u.primary_crop) end,
                 'farm_size', case when o.farm_size_hectares is distinct from u.farm_size_hectares
                                   then jsonb_build_object('from', o.farm_size_hectares, 'to', u.farm_size_hectares) end
               )),
               ${ip}::text
        from updated u join old o on o.id = u.id
      )
      select true as changed, id::text as id, full_name, phone, village,
             primary_crop, farm_size_hectares::float8 as farm_size_hectares,
             gps_lat, gps_lng, created_at
      from updated
      union all
      select false, id::text, full_name, phone, village, primary_crop,
             farm_size_hectares::float8, gps_lat, gps_lng, created_at
      from old
      where not exists (select 1 from updated)`;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Farmer not found. They may have been removed." },
        { status: 404 }
      );
    }
    const { changed, ...farmer } = rows[0];
    return NextResponse.json({ farmer, changed: Boolean(changed) });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json(
        { errors: { phone: "Another farmer already has this phone number" } },
        { status: 409 }
      );
    }
    console.error("PUT /api/farmers/[id] failed:", err);
    return NextResponse.json({ error: "Could not save changes" }, { status: 500 });
  }
}
