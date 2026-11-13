import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { clientIp, requireUser } from "@/lib/auth";
import { DELETE_REASONS } from "@/lib/farmers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(request, ["admin"]);
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
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >;

  const reason = DELETE_REASONS.find((r) => r === b.reason);
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 200) : "";
  if (!reason) {
    return NextResponse.json(
      { errors: { reason: "Choose a reason" } },
      { status: 400 }
    );
  }
  if (reason === "Other" && note.length < 3) {
    return NextResponse.json(
      { errors: { note: "Please explain the reason" } },
      { status: 400 }
    );
  }
  const ip = clientIp(request);

  try {
    const sql = getSql();
    // One statement: delete the farmer, keep the reason, and write the activity
    // log entry. Either all three happen or none do.
    const rows = await sql`
      with removed as (
        delete from farmers where id = ${id}::bigint
        returning id, village, primary_crop, farm_size_hectares, created_at
      ), logged as (
        insert into deletion_log
          (farmer_id, village, primary_crop, farm_size_hectares,
           farmer_created_at, reason, note, deleted_by)
        select id, village, primary_crop, farm_size_hectares, created_at,
               ${reason}::text, ${note || null}::text, ${user.id}::bigint
        from removed
        returning farmer_id
      ), audit as (
        insert into activity_log (user_id, username, action, farmer_id, details, ip)
        select ${user.id}::bigint, ${user.username}::text, 'farmer.remove', id,
               jsonb_build_object('reason', ${reason}::text,
                                  'note', ${note || null}::text,
                                  'village', village, 'crop', primary_crop),
               ${ip}::text
        from removed
      )
      select farmer_id from logged`;
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Farmer not found. It may already be removed." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/farmers/[id]/delete failed:", err);
    return NextResponse.json({ error: "Could not remove farmer" }, { status: 500 });
  }
}
