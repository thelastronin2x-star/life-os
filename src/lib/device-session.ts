import "server-only";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";

export const DEVICE_COOKIE = "device_id";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365 * 2, // 2 years — this is the whole identity a push subscription hangs off, shouldn't quietly expire
};

/** A separate, unencrypted identity from monobank.ts's `mono_session` —
 *  that one only exists once a bank is connected, and push has to work for
 *  someone who never does that. Nothing sensitive rides on this value (it's
 *  just an opaque key to group push subscriptions and synced reminders), so
 *  unlike the JWT-encrypted mono_session it doesn't need the same treatment
 *  — a plain random id is enough. */
export async function getOrCreateDeviceId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEVICE_COOKIE)?.value;
  if (existing) return existing;

  const id = randomUUID();
  cookieStore.set(DEVICE_COOKIE, id, COOKIE_OPTIONS);
  return id;
}
