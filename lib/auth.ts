import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSql } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const SESSION_COOKIE = "ogwashi_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

export type Role = "admin" | "agent";
export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  mustChangePassword: boolean;
};

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters");
  }
  return s;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

// The cookie holds: user id, the user's session version, expiry, signature.
// Changing or resetting a password raises the version, which ends every
// older session for that person.
export function createSessionToken(userId: string, version: number): string {
  const payload = `${userId}.${version}.${Math.floor(Date.now() / 1000) + SESSION_MAX_AGE}`;
  return `${payload}.${sign(payload)}`;
}

export function readToken(
  token: string | undefined
): { userId: string; version: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, version, expires, sig] = parts;
  if (
    !/^\d{1,18}$/.test(userId) ||
    !/^\d{1,9}$/.test(version) ||
    !/^\d{1,12}$/.test(expires)
  ) {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(`${userId}.${version}.${expires}`));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expires) <= Math.floor(Date.now() / 1000)) return null;
  return { userId, version: Number(version) };
}

// Checks the database on every request, so disabling a user or changing
// their password takes effect at once
export async function getSessionUser(
  request: NextRequest
): Promise<SessionUser | null> {
  const token = readToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!token) return null;
  const sql = getSql();
  const rows = await sql`
    select id::text as id, username, display_name, role,
           must_change_password, session_version
    from users
    where id = ${token.userId}::bigint and active`;
  const row = rows[0];
  if (!row || Number(row.session_version) !== token.version) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role as Role,
    mustChangePassword: Boolean(row.must_change_password),
  };
}

export function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

type Gate = { user: SessionUser } | { response: NextResponse };

// Use at the top of every API route:
//   const auth = await requireUser(request, ["admin"]);
//   if ("response" in auth) return auth.response;
// People on a temporary password can only reach routes that pass
// { allowMustChange: true } until they choose their own password.
export async function requireUser(
  request: NextRequest,
  allowed?: Role[],
  options?: { allowMustChange?: boolean }
): Promise<Gate> {
  let user: SessionUser | null;
  try {
    user = await getSessionUser(request);
  } catch (err) {
    console.error("Session check failed:", err);
    return {
      response: NextResponse.json(
        { error: "Service unavailable. Try again." },
        { status: 503 }
      ),
    };
  }
  if (!user) {
    return {
      response: NextResponse.json({ error: "Not logged in" }, { status: 401 }),
    };
  }
  if (user.mustChangePassword && !options?.allowMustChange) {
    return {
      response: NextResponse.json(
        { error: "Choose a new password first", code: "must_change_password" },
        { status: 403 }
      ),
    };
  }
  if (allowed && !allowed.includes(user.role)) {
    await logActivity({
      user,
      action: "access.denied",
      details: { path: new URL(request.url).pathname, method: request.method },
      ip: clientIp(request),
    });
    return {
      response: NextResponse.json(
        { error: "You do not have permission to do this" },
        { status: 403 }
      ),
    };
  }
  return { user };
}
