import { NextRequest, NextResponse, connection } from "next/server";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  await connection();
  const auth = await requireUser(request, undefined, { allowMustChange: true });
  if ("response" in auth) return auth.response;
  return NextResponse.json({ user: auth.user });
}
