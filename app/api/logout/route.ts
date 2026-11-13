import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, clientIp, getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (user) await logActivity({ user, action: "logout", ip: clientIp(request) });
  } catch {
    // Even if this fails, still clear the cookie below
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
