import "server-only";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { COOKIE_OPTIONS, SESSION_COOKIE, encryptSession } from "@/lib/monobank";
import { monobankBankSource } from "@/lib/monobank-bank-source";
import { registerWebhookSecret } from "@/lib/monobank-webhook-store";
import { createBankConnection } from "@/lib/db/bank-connections";
import type { BankAccount } from "@/lib/bank-source";

/** Shared by both connect paths — the manual personal-token form (whose
 *  own route can set the cookie directly in its response) and the
 *  Corporate deep-link flow's status-poll route (the only place in that
 *  flow that runs in the user's browser request/response cycle and can
 *  therefore set a cookie; the webhook route that actually receives the
 *  token is a server-to-server call from Monobank with no cookie jar).
 *  Fetches accounts, registers the personal-token webhook, writes the
 *  server-side bank_connections row, and sets the session cookie — the
 *  exact same "you're connected" outcome regardless of how the token was
 *  obtained. */
export async function completeMonobankConnection(
  token: string,
  origin: string
): Promise<{ accounts: BankAccount[] }> {
  const accounts = await monobankBankSource.fetchAccounts(token);

  const secretId = randomBytes(32).toString("hex");
  await registerWebhookSecret(secretId);
  try {
    const webhookUrl = `${origin}/api/finance/monobank/webhook/${secretId}`;
    await monobankBankSource.registerWebhook(token, webhookUrl);
  } catch (e) {
    // Non-fatal: manual sync still works without live push updates.
    console.error("Monobank webhook registration failed", e);
  }

  let userId: string | undefined;
  let connectionId: string | undefined;
  try {
    userId = crypto.randomUUID();
    const created = await createBankConnection({
      userId,
      provider: "monobank",
      encryptedToken: await encryptSession({ token }),
      webhookSecretId: secretId,
    });
    connectionId = created.id;
  } catch (e) {
    userId = undefined;
    connectionId = undefined;
    console.error("Bank connection DB write failed", e);
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await encryptSession({ token, webhookSecretId: secretId, userId, connectionId }), {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 180,
  });

  return { accounts };
}
