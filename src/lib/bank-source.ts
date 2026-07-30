/** Bank-agnostic seam between "where banking data comes from" and the rest
 *  of the app. The Monobank personal-token integration (monobank.ts,
 *  monobank-webhook-verify.ts) is currently the only implementation of this
 *  interface — see monobank-bank-source.ts. Introduced so a future
 *  provider-style API or a different bank could be added without any other
 *  code (API routes, the sync hooks, the transaction-import pipeline)
 *  needing to change or learn a new shape.
 *
 *  Deliberately excludes authentication/session concerns (how a token gets
 *  stored, refreshed, or tied to a user) — those stay exactly as they are
 *  today; every method here just takes a bare token, matching how the
 *  existing Monobank client already works. */

export interface BankAccount {
  id: string;
  balance: number; // minor units
  currencyCode: number; // numeric ISO 4217
  maskedPan: string[];
  type: string;
}

export interface BankTransaction {
  id: string;
  time: number; // unix seconds
  description: string;
  mcc: number;
  hold: boolean; // true = pending pre-authorization, not yet settled
  amount: number; // minor units, negative = money out
  balance: number; // minor units, account balance right after this transaction
}

export interface BankWebhookEvent {
  accountId: string;
  transaction: BankTransaction;
}

/** Why a raw webhook delivery couldn't be turned into a `BankWebhookEvent` —
 *  kept distinct (rather than collapsing to a single failure) because the
 *  webhook route maps each reason to its own HTTP status/error body, and
 *  that mapping predates this interface. `ok: true, event: null` is a
 *  valid, successfully-verified delivery that just isn't a transaction
 *  event worth queuing (e.g. a different notification type). */
export type WebhookParseResult =
  | { ok: true; event: BankWebhookEvent | null }
  | { ok: false; reason: "missing_signature" | "invalid_signature" | "invalid_payload" };

/** Thrown by any BankDataSource method on a failed request — `status` lets
 *  callers detect e.g. rate-limiting (429) or an invalid token (403)
 *  generically, without knowing which bank's error type they're catching. */
export class BankSourceError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export interface BankDataSource {
  fetchAccounts(token: string): Promise<BankAccount[]>;
  /** `to` is exclusive-ish per Monobank's own docs; every implementation is
   *  expected to enforce whatever its own bank's max-range limit is. */
  fetchStatement(token: string, accountId: string, fromSeconds: number, toSeconds: number): Promise<BankTransaction[]>;
  /** Registers (or, with an empty `webhookUrl`, unsubscribes) the
   *  account-wide webhook for this token. */
  registerWebhook(token: string, webhookUrl: string): Promise<void>;
  unregisterWebhook(token: string): Promise<void>;
  /** Verifies AND parses a raw webhook delivery in one step — signature
   *  verification is itself bank-specific, so it can't be split out. */
  parseWebhookEvent(rawBody: Buffer, headers: Record<string, string | null>): Promise<WebhookParseResult>;
}
