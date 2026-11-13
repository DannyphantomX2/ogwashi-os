import { getSql } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

type Entry = {
  user?: Pick<SessionUser, "id" | "username"> | null;
  username?: string | null; // for events with no logged-in user, like a failed login
  action: string;
  farmerId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
};

// Best effort: a logging problem must never block the person's real action.
// Farmer create/remove write their own log rows in the same database
// statement, so those can never be saved without a log entry.
export async function logActivity(entry: Entry): Promise<void> {
  try {
    const sql = getSql();
    await sql`
      insert into activity_log (user_id, username, action, farmer_id, details, ip)
      values (
        ${entry.user?.id ?? null}::bigint,
        ${entry.user?.username ?? entry.username ?? null}::text,
        ${entry.action}::text,
        ${entry.farmerId ?? null}::bigint,
        ${JSON.stringify(entry.details ?? {})}::jsonb,
        ${entry.ip ?? null}::text
      )`;
  } catch (err) {
    console.error("Could not write activity log:", err);
  }
}
