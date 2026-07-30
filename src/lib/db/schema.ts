import { pgTable, text, integer, bigint, bigserial, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/** Minimum entities for the server becoming the source of truth for
 *  transactions (see monobank-server-ledger-prompt.md, Stage 2). No auth,
 *  no registration, no billing — `userId` is a stable identifier generated
 *  at bank-connect time and carried in the session cookie (see monobank.ts's
 *  MonobankSession), not a real account system. It's threaded through every
 *  table from day one specifically so adding real multi-user auth later
 *  never requires a backfill migration on a populated database. */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** One row per connected bank session (today: one Monobank personal token).
 *  `provider` exists so a second bank/provider-API implementation later is
 *  a new row shape, not a schema change. */
export const bankConnections = pgTable("bank_connections", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  provider: text("provider").notNull(), // "monobank" for now
  encryptedToken: text("encrypted_token").notNull(),
  webhookSecretId: text("webhook_secret_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** One row per local FinanceAccount bound to a bank-side account under a
 *  connection — the server-side equivalent of the client's MonobankLink.
 *  Unique on (connectionId, providerAccountId) so re-linking the same bank
 *  account is an upsert (label/localAccountId can change), not a duplicate row. */
export const bankAccountLinks = pgTable(
  "bank_account_links",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    connectionId: text("connection_id")
      .notNull()
      .references(() => bankConnections.id),
    providerAccountId: text("provider_account_id").notNull(), // bank-side account id
    localAccountId: text("local_account_id").notNull(), // the client's FinanceAccount.id
    label: text("label").notNull(), // masked pan / iban, display only
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("bank_account_links_connection_provider_idx").on(table.connectionId, table.providerAccountId)]
);

/** The ledger itself. Dedup is a database-level guarantee, not application
 *  code: `(source, externalId)` is unique, so two webhook deliveries (or a
 *  webhook delivery racing a statement backfill) for the same underlying
 *  bank transaction can never both insert — the second insert is expected
 *  to conflict and should be handled with an ON CONFLICT DO NOTHING, not a
 *  pre-check. `externalId` is null for manually-entered transactions, which
 *  Postgres treats as never colliding with each other under a UNIQUE index
 *  (NULL <> NULL) — exactly right, since two manual entries are never the
 *  "same" transaction just because both lack an external id. */
export const ledgerTransactions = pgTable(
  "ledger_transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // Null for a manual/non-bank transaction, or a bank transaction whose
    // provider account isn't (yet) linked to a local account on the server.
    accountLinkId: text("account_link_id").references(() => bankAccountLinks.id),
    source: text("source").notNull(), // "monobank" | "manual" | future provider names
    externalId: text("external_id"), // the bank's own transaction id; null for manual entries
    timeSeconds: bigint("time_seconds", { mode: "number" }), // unix seconds, null if unknown
    description: text("description").notNull(),
    mcc: integer("mcc"),
    amountMinorUnits: integer("amount_minor_units").notNull(), // negative = money out
    isPending: boolean("is_pending").notNull().default(false), // holds: recorded, never authoritative (see Stage 3)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Strictly-increasing, gap-tolerant cursor for GET /api/finance/ledger
    // (Stage 5) — deliberately NOT createdAt: two rows can share a
    // millisecond, which would risk a client's `since` boundary silently
    // skipping one of them. A bigserial can never tie.
    sequence: bigserial("sequence", { mode: "number" }).notNull(),
  },
  (table) => [uniqueIndex("ledger_transactions_source_external_id_idx").on(table.source, table.externalId)]
);

/** A point-in-time balance reading. `source` distinguishes the two very
 *  different reasons one of these exists:
 *  - "transaction-event": recorded alongside a ledger transaction (Stage 3)
 *    — NEVER authoritative on its own (see reconcileBalanceFromLiveBalance
 *    in monobank-sync.ts: a concurrent hold can skew it).
 *  - "client-info": a live full-balance fetch, done server-side under the
 *    shared rate limiter (Stage 6) — this one IS authoritative, and no
 *    longer depends on the client's own request happening to dodge a 429. */
export const balanceSnapshots = pgTable("balance_snapshots", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  accountLinkId: text("account_link_id")
    .notNull()
    .references(() => bankAccountLinks.id),
  balanceMinorUnits: integer("balance_minor_units").notNull(),
  source: text("source").notNull().default("transaction-event"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Tracks a durable, chained history-backfill run for one account link —
 *  Stage 6 replaces the old client-side sleep-loop (refreshHistory in
 *  use-monobank.ts, up to 80 iterations at 61s apart, guaranteed to blow a
 *  serverless function's execution-time limit) with one QStash-triggered
 *  step at a time, each one persisting its progress here before scheduling
 *  the next — so progress survives across invocations and is visible to
 *  the client via a simple status read, not held in memory anywhere. */
export const backfillJobs = pgTable("backfill_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  accountLinkId: text("account_link_id")
    .notNull()
    .references(() => bankAccountLinks.id),
  status: text("status").notNull().default("running"), // "running" | "done" | "failed"
  // How far back (unix seconds) the next window should end — walks
  // backward one ~31-day window per step until historyExhausted.
  cursorSeconds: bigint("cursor_seconds", { mode: "number" }).notNull(),
  windowsProcessed: integer("windows_processed").notNull().default(0),
  historyExhausted: boolean("history_exhausted").notNull().default(false),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
