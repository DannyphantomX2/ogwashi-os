import { NextResponse, connection } from "next/server";
import { getSql } from "@/lib/db";

// Public on purpose: the login screen calls this when it opens, so the
// sleeping database is already waking up while someone types their password.
// It returns nothing useful to anyone, and touches the database at most once
// a minute per server instance.
let lastWarm = 0;
const MIN_GAP_MS = 60_000;

export async function GET() {
  await connection();
  const now = Date.now();
  if (now - lastWarm >= MIN_GAP_MS) {
    lastWarm = now;
    try {
      const sql = getSql();
      await sql`select 1`;
    } catch {
      // Nothing to report. This only exists to wake the database.
    }
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
