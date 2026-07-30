import "server-only";
import { createHash } from "crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "mono_session";

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// Same derivation as google-calendar.ts — one server secret, distinct cookies
// per integration since the encrypted payloads differ.
const encryptionKey = createHash("sha256").update(process.env.SESSION_SECRET ?? "").digest();

export interface MonobankSession {
  token: string;
  webhookSecretId?: string;
  /** Stable per-connection identifier, generated at connect time — the seam
   *  the server-side ledger (bank-connections.ts, ledger.ts) threads through
   *  every row instead of real multi-user auth (see monobank-server-ledger-
   *  prompt.md, Stage 2). */
  userId?: string;
  /** The bank_connections row's own id — lets browser-originated requests
   *  (e.g. linking an account) write to the ledger without a lookup by
   *  webhookSecretId, which only the webhook route (no cookie) needs. */
  connectionId?: string;
}

export async function encryptSession(session: MonobankSession): Promise<string> {
  return new EncryptJWT({ ...session })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("180d")
    .encrypt(encryptionKey);
}

export async function decryptSession(token: string): Promise<MonobankSession | null> {
  try {
    const { payload } = await jwtDecrypt(token, encryptionKey);
    return payload as unknown as MonobankSession;
  } catch {
    return null;
  }
}

export async function getStoredSession(): Promise<MonobankSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decryptSession(raw);
}

export async function getStoredToken(): Promise<string | null> {
  const session = await getStoredSession();
  return session?.token ?? null;
}

export interface MonobankAccount {
  id: string;
  balance: number; // minor units (kopecks)
  creditLimit: number;
  type: string;
  currencyCode: number; // numeric ISO 4217
  maskedPan: string[];
  iban: string;
}

export interface MonobankTransaction {
  id: string;
  time: number; // unix seconds
  description: string;
  mcc: number;
  hold: boolean; // true = pending pre-authorization, not yet settled
  amount: number; // minor units, negative = money out
  operationAmount: number;
  currencyCode: number;
  commissionRate: number;
  cashbackAmount: number;
  balance: number;
  comment?: string;
}

class MonobankApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function monoFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.monobank.ua${path}`, {
    headers: { "X-Token": token },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new MonobankApiError(res.status, await res.text().catch(() => res.statusText));
  }
  return res.json();
}

export { MonobankApiError };

export async function fetchClientInfo(token: string): Promise<{ accounts: MonobankAccount[] }> {
  return monoFetch("/personal/client-info", token);
}

/** Registers (or, with an empty `webhookUrl`, unsubscribes) the account-wide
 *  webhook for this token. Monobank immediately sends a plain GET to the new
 *  URL to check it's reachable (expects a 200) before events start flowing. */
export async function registerWebhook(token: string, webhookUrl: string): Promise<void> {
  const res = await fetch("https://api.monobank.ua/personal/webhook", {
    method: "POST",
    headers: { "X-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ webHookUrl: webhookUrl }),
  });
  if (!res.ok) {
    throw new MonobankApiError(res.status, await res.text().catch(() => res.statusText));
  }
}

/** `to` is exclusive-ish per Monobank's own docs; range must not exceed 31 days + 1 hour. */
export async function fetchStatement(
  token: string,
  accountId: string,
  fromSeconds: number,
  toSeconds: number
): Promise<MonobankTransaction[]> {
  return monoFetch(`/personal/statement/${accountId}/${fromSeconds}/${toSeconds}`, token);
}
