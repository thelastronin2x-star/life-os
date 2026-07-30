import "server-only";
import { createHash } from "crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "gcal_session";
export const STATE_COOKIE = "gcal_oauth_state";

const GOOGLE_SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/calendar.events"].join(
  " "
);

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

const encryptionKey = createHash("sha256").update(process.env.SESSION_SECRET ?? "").digest();

export interface GoogleSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
}

export async function encryptSession(session: GoogleSession): Promise<string> {
  return new EncryptJWT({ ...session })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("60d")
    .encrypt(encryptionKey);
}

export async function decryptSession(token: string): Promise<GoogleSession | null> {
  try {
    const { payload } = await jwtDecrypt(token, encryptionKey);
    return payload as unknown as GoogleSession;
  } catch {
    return null;
  }
}

export function getGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
  token_type: string;
  scope: string;
}

async function requestToken(body: URLSearchParams): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Google token request failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export function exchangeCodeForTokens(code: string, redirectUri: string) {
  return requestToken(
    new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    })
  );
}

export function refreshAccessToken(refreshToken: string) {
  return requestToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    })
  );
}

export async function tokensToSession(
  tokens: GoogleTokenResponse,
  previousEmail?: string
): Promise<GoogleSession> {
  const { decodeJwt } = await import("jose");
  const email = tokens.id_token
    ? (decodeJwt(tokens.id_token) as { email?: string }).email
    : previousEmail;

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    email,
  };
}

/** Reads the session cookie, refreshing the access token if it has expired. */
export async function getValidSession(): Promise<GoogleSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const session = await decryptSession(raw);
  if (!session) return null;

  if (Date.now() < session.expiresAt - 60_000) {
    return session;
  }

  if (!session.refreshToken) {
    return null;
  }

  try {
    const tokens = await refreshAccessToken(session.refreshToken);
    const updated: GoogleSession = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? session.refreshToken,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      email: session.email,
    };
    cookieStore.set(SESSION_COOKIE, await encryptSession(updated), {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 60,
    });
    return updated;
  } catch {
    return null;
  }
}
