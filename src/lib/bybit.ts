import "server-only";
import { createHash, createHmac } from "crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";
import { fetchAllPages } from "./bybit-paginate";

export const SESSION_COOKIE = "bybit_session";

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// Same derivation as google-calendar.ts/monobank.ts — one server secret, a
// distinct cookie per integration since the encrypted payloads differ.
const encryptionKey = createHash("sha256").update(process.env.SESSION_SECRET ?? "").digest();

export interface BybitSession {
  apiKey: string;
  apiSecret: string;
}

export async function encryptSession(session: BybitSession): Promise<string> {
  return new EncryptJWT({ ...session })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("180d")
    .encrypt(encryptionKey);
}

export async function decryptSession(token: string): Promise<BybitSession | null> {
  try {
    const { payload } = await jwtDecrypt(token, encryptionKey);
    return payload as unknown as BybitSession;
  } catch {
    return null;
  }
}

export async function getStoredSession(): Promise<BybitSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decryptSession(raw);
}

const BASE_URL = "https://api.bybit.com";
const RECV_WINDOW = "5000";

function sign(secret: string, timestamp: string, apiKey: string, queryString: string): string {
  const payload = timestamp + apiKey + RECV_WINDOW + queryString;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export class BybitApiError extends Error {
  constructor(
    public retCode: number,
    message: string
  ) {
    super(message);
  }
}

async function bybitGet<T>(session: BybitSession, path: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params).toString();
  const timestamp = Date.now().toString();
  const signature = sign(session.apiSecret, timestamp, session.apiKey, query);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}?${query}`, {
      headers: {
        "X-BAPI-API-KEY": session.apiKey,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-SIGN": signature,
        "X-BAPI-RECV-WINDOW": RECV_WINDOW,
      },
      cache: "no-store",
    });
  } catch (e) {
    throw new BybitApiError(-1, `Не вдалося з'єднатися з Bybit: ${e instanceof Error ? e.message : String(e)}`);
  }

  const rawText = await res.text();
  let data: { retCode?: number; retMsg?: string; result?: unknown };
  try {
    data = JSON.parse(rawText);
  } catch {
    // A non-JSON body on a 403 is CloudFront's own block page, not Bybit's
    // API — this is what region blocking looks like in practice, and it's
    // easy to mistake for a bad API key since the API itself never gets a
    // chance to respond. See README's "Deployment notes" for the actual fix.
    if (res.status === 403) {
      throw new BybitApiError(
        -2,
        "Bybit заблокував запит за регіоном сервера. Це не пов'язано з ключем — переконайся, що регіон функцій у Vercel (Settings → Functions) європейський."
      );
    }
    throw new BybitApiError(
      -2,
      `Bybit повернув неочікувану відповідь (HTTP ${res.status}): ${rawText.slice(0, 200)}`
    );
  }

  if (data.retCode !== 0) {
    throw new BybitApiError(data.retCode ?? -3, data.retMsg || `Bybit HTTP ${res.status}, retCode ${data.retCode}`);
  }
  return data.result as T;
}

export interface BybitClosedPnlItem {
  symbol: string;
  orderId: string;
  /** The direction of the ORDER THAT CLOSED the position — opposite of the
   *  position's own direction. Closing a long takes a Sell order; closing a
   *  short takes a Buy order. See use-bybit.ts's direction mapping. */
  side: "Buy" | "Sell";
  qty: string;
  avgEntryPrice: string;
  avgExitPrice: string;
  closedPnl: string;
  openFee: string;
  closeFee: string;
  createdTime: string; // unix ms, as string
  updatedTime: string; // unix ms, as string
}

/** Cheap authenticated call used purely to validate a key/secret pair. */
export async function verifyCredentials(session: BybitSession): Promise<void> {
  await bybitGet<unknown>(session, "/v5/position/closed-pnl", { category: "linear", limit: "1" });
}

// 50 pages * 200 = 10,000 closed positions in a single 7-day window is
// already far beyond realistic trading volume — see fetchAllPages for why
// this exists at all.
const MAX_PAGES = 50;

export async function fetchClosedPnl(
  session: BybitSession,
  category: "linear" | "inverse",
  startTimeMs: number,
  endTimeMs: number
): Promise<BybitClosedPnlItem[]> {
  return fetchAllPages<BybitClosedPnlItem>((cursor) => {
    const params: Record<string, string> = {
      category,
      startTime: String(startTimeMs),
      endTime: String(endTimeMs),
      limit: "200",
    };
    if (cursor) params.cursor = cursor;
    return bybitGet(session, "/v5/position/closed-pnl", params);
  }, MAX_PAGES);
}
