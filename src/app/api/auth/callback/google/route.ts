import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_OPTIONS,
  SESSION_COOKIE,
  STATE_COOKIE,
  encryptSession,
  exchangeCodeForTokens,
  tokensToSession,
} from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (error) {
    return NextResponse.redirect(new URL(`/calendar?gcal_error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL("/calendar?gcal_error=invalid_state", request.url));
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/callback/google`;

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const session = await tokensToSession(tokens);

    cookieStore.set(SESSION_COOKIE, await encryptSession(session), {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 60,
    });

    return NextResponse.redirect(new URL("/calendar?gcal_connected=1", request.url));
  } catch (e) {
    console.error("Google OAuth callback failed", e);
    return NextResponse.redirect(new URL("/calendar?gcal_error=token_exchange_failed", request.url));
  }
}
