import { NextRequest, NextResponse, connection } from "next/server";
import { getSql } from "@/lib/db";
import { clientIp, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { formatPhone } from "@/lib/format";

function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

// Stops spreadsheet apps from running text that starts like a formula
function textCell(v: string): string {
  return cell(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
}

export async function GET(request: NextRequest) {
  await connection();
  const auth = await requireUser(request, ["admin"]);
  if ("response" in auth) return auth.response;
  try {
    const sql = getSql();
    const rows = await sql`
      select id::text as id, full_name, phone, village, primary_crop,
             farm_size_hectares::float8 as farm_size_hectares,
             gps_lat, gps_lng, created_at
      from farmers
      order by created_at`;

    const header = [
      "ID",
      "Full name",
      "Phone",
      "Village",
      "Main crop",
      "Farm size (ha)",
      "GPS latitude",
      "GPS longitude",
      "Registered at",
    ];
    const lines = [header.map(cell).join(",")];
    for (const r of rows) {
      lines.push(
        [
          cell(r.id),
          textCell(String(r.full_name)),
          cell(formatPhone(String(r.phone))),
          cell(r.village),
          cell(r.primary_crop),
          cell(r.farm_size_hectares),
          cell(r.gps_lat),
          cell(r.gps_lng),
          cell(new Date(r.created_at).toISOString()),
        ].join(",")
      );
    }

    await logActivity({
      user: auth.user,
      action: "export.csv",
      details: { rows: rows.length },
      ip: clientIp(request),
    });

    const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ogwashi-farmers-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/export failed:", err);
    return NextResponse.json({ error: "Could not export" }, { status: 500 });
  }
}
