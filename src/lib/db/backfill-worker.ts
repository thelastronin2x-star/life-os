import "server-only";
import { getBackfillJob, updateBackfillJob, getBackfillLinkContext } from "./backfill";
import { insertLedgerTransaction } from "./ledger";
import { decryptSession } from "../monobank";
import { monobankBankSource } from "../monobank-bank-source";
import { BankSourceError } from "../bank-source";
import { qstashClient } from "../qstash-client";

const MAX_RANGE_SECONDS = 31 * 24 * 60 * 60;
const MAX_WINDOWS = 80; // ~6.8 years of 31-day windows — same hard cap the old client-side loop used
const STEP_DELAY_SECONDS = 61; // Monobank's own per-account statement rate limit

/** Processes exactly one 31-day window of history for a backfill job, then
 *  either enqueues the next window (via a delayed QStash message back to
 *  this same endpoint) or marks the job done/failed. Never loops in-process
 *  — this is what makes it safe to run inside a bounded serverless function
 *  invocation, unlike the old client-side sleep-loop it replaces (Stage 6). */
export async function processBackfillStep(jobId: string, stepUrl: string): Promise<void> {
  const job = await getBackfillJob(jobId);
  if (!job || job.status !== "running") return;

  const link = await getBackfillLinkContext(job.accountLinkId);
  if (!link) {
    await updateBackfillJob(jobId, { status: "failed", lastError: "account_link_not_found" });
    return;
  }

  const session = await decryptSession(link.encryptedToken);
  if (!session) {
    await updateBackfillJob(jobId, { status: "failed", lastError: "token_decrypt_failed" });
    return;
  }

  const to = job.cursorSeconds;
  const from = to - MAX_RANGE_SECONDS;

  let raw;
  try {
    raw = await monobankBankSource.fetchStatement(session.token, link.providerAccountId, from, to);
  } catch (e) {
    if (e instanceof BankSourceError && e.status === 429) {
      // Rate-limited — retry the SAME window later, no progress lost.
      await qstashClient.publishJSON({ url: stepUrl, body: { jobId }, delay: STEP_DELAY_SECONDS });
      return;
    }
    console.error("Backfill step failed", jobId, e);
    await updateBackfillJob(jobId, { status: "failed", lastError: e instanceof Error ? e.message : "fetch_failed" });
    return;
  }

  for (const t of raw) {
    if (t.hold) continue; // holds never enter the ledger, same as the webhook path
    await insertLedgerTransaction({
      userId: job.userId,
      accountLinkId: job.accountLinkId,
      source: "monobank",
      transaction: t,
    });
  }

  const historyExhausted = raw.length === 0;
  const windowsProcessed = job.windowsProcessed + 1;
  const done = historyExhausted || windowsProcessed >= MAX_WINDOWS;

  await updateBackfillJob(jobId, {
    cursorSeconds: from - 1,
    windowsProcessed,
    historyExhausted,
    status: done ? "done" : "running",
  });

  if (!done) {
    await qstashClient.publishJSON({ url: stepUrl, body: { jobId }, delay: STEP_DELAY_SECONDS });
  }
}
