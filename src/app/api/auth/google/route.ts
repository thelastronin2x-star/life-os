import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_OPTIONS, STATE_COOKIE, getGoogleAuthUrl } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const state = randomBytes(16).toString("hex");
  const redirectUri = `${request.nextUrl.origin}/api/auth/callback/google`;

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, { ...COOKIE_OPTIONS, maxAge: 60 * 10 });

  return NextResponse.redirect(getGoogleAuthUrl(redirectUri, state));
}
