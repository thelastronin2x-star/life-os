import "server-only";
import crypto from "crypto";

/** True only once real Corporate/Provider API credentials exist (a signed
 *  application approved by Monobank — see the connect route for the
 *  precondition). Read lazily wherever it's checked, not cached at module
 *  load, so toggling the env var doesn't need a rebuild in dev. */
export function isMonobankCorpEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MONOBANK_CORP_ENABLED === "1";
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — Monobank Corporate API isn't configured yet`);
  return value;
}

/** ECDSA-SHA256 request signing for Monobank's Corporate/Provider API —
 *  entirely separate key and purpose from monobank-webhook-verify.ts, which
 *  verifies signatures MONOBANK produces on its own outgoing webhooks
 *  (secp256k1, their key). This signs OUR outgoing requests TO Monobank
 *  with OUR OWN keypair (openssl ecparam -genkey -name prime256v1), proving
 *  our identity as the registered provider. `secondIngredient` is the
 *  existing user token for most endpoints, or the requested permission
 *  string (e.g. "sp") for the one endpoint that doesn't have a token yet:
 *  POST /personal/auth/request. */
export function signMonobankCorpRequest(resource: string, secondIngredient: string): Record<string, string> {
  const privateKey = requireEnv("MONOBANK_CORP_PRIVATE_KEY");
  const keyId = requireEnv("MONOBANK_CORP_KEY_ID");

  const time = Math.floor(Date.now() / 1000).toString();
  const stringToSign = `${time}${secondIngredient}${resource}`;

  const signature = crypto.sign("sha256", Buffer.from(stringToSign), privateKey);

  return {
    "X-Time": time,
    "X-Sign": signature.toString("base64"),
    "X-Key-Id": keyId,
  };
}

/** One-time setup call, not wired to any route — run manually (e.g. from a
 *  scratch script) once Corporate API access is approved, pointing at the
 *  permanent webhook URL for account-wide Corporate notifications. This is
 *  distinct from the per-request X-Callback used in the connect route
 *  below, which only carries that one auth request's confirmation. */
export async function registerMonobankCorpWebhook(webhookUrl: string): Promise<void> {
  const headers = signMonobankCorpRequest("/personal/corp/webhook", "");
  const res = await fetch("https://api.monobank.ua/personal/corp/webhook", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ webHookUrl: webhookUrl }),
  });
  if (!res.ok) {
    throw new Error(`registerMonobankCorpWebhook failed: ${res.status} ${await res.text().catch(() => res.statusText)}`);
  }
}
