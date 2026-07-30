import "server-only";
import {
  fetchClientInfo,
  registerWebhook as monobankRegisterWebhook,
  fetchStatement as monobankFetchStatement,
  MonobankApiError,
} from "./monobank";
import { verifyMonobankWebhook } from "./monobank-webhook-verify";
import { checkClientInfoRateLimit, checkStatementRateLimit } from "./monobank-rate-limit";
import { BankSourceError, type BankDataSource, type BankTransaction, type WebhookParseResult } from "./bank-source";

interface MonobankWebhookBody {
  type: string;
  data: {
    account: string;
    statementItem: BankTransaction;
  };
}

/** The Monobank personal-token implementation of BankDataSource — the only
 *  place that still knows about X-Token, Monobank's REST endpoints, or its
 *  webhook signature scheme. Everything else in the app (API routes, the
 *  sync hooks, monobank-import.ts) talks only to the BankDataSource shape. */
export const monobankBankSource: BankDataSource = {
  async fetchAccounts(token) {
    const { allowed, retryAfterMs } = await checkClientInfoRateLimit(token);
    if (!allowed) {
      throw new BankSourceError(429, `client-info rate limit — retry in ${retryAfterMs}ms`);
    }
    try {
      const info = await fetchClientInfo(token);
      return info.accounts.map((a) => ({
        id: a.id,
        balance: a.balance,
        currencyCode: a.currencyCode,
        maskedPan: a.maskedPan,
        type: a.type,
      }));
    } catch (e) {
      if (e instanceof MonobankApiError) throw new BankSourceError(e.status, e.message);
      throw e;
    }
  },

  async fetchStatement(token, accountId, fromSeconds, toSeconds) {
    const { allowed, retryAfterMs } = await checkStatementRateLimit(token, accountId);
    if (!allowed) {
      throw new BankSourceError(429, `statement rate limit — retry in ${retryAfterMs}ms`);
    }
    try {
      const raw = await monobankFetchStatement(token, accountId, fromSeconds, toSeconds);
      return raw.map((t) => ({
        id: t.id,
        time: t.time,
        description: t.description,
        mcc: t.mcc,
        hold: t.hold,
        amount: t.amount,
        balance: t.balance,
      }));
    } catch (e) {
      if (e instanceof MonobankApiError) throw new BankSourceError(e.status, e.message);
      throw e;
    }
  },

  async registerWebhook(token, webhookUrl) {
    try {
      await monobankRegisterWebhook(token, webhookUrl);
    } catch (e) {
      if (e instanceof MonobankApiError) throw new BankSourceError(e.status, e.message);
      throw e;
    }
  },

  async unregisterWebhook(token) {
    await monobankBankSource.registerWebhook(token, "");
  },

  async parseWebhookEvent(rawBody, headers): Promise<WebhookParseResult> {
    const xSign = headers["x-sign"];
    const xKeyId = headers["x-key-id"];
    if (!xSign || !xKeyId) {
      return { ok: false, reason: "missing_signature" };
    }

    const verified = await verifyMonobankWebhook(rawBody, xSign, xKeyId);
    if (!verified) {
      return { ok: false, reason: "invalid_signature" };
    }

    let body: MonobankWebhookBody;
    try {
      body = JSON.parse(rawBody.toString("utf-8"));
    } catch {
      return { ok: false, reason: "invalid_payload" };
    }

    if (body.type !== "StatementItem" || !body.data?.statementItem) {
      return { ok: true, event: null };
    }

    return {
      ok: true,
      event: { accountId: body.data.account, transaction: body.data.statementItem },
    };
  },
};
