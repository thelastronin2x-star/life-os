import { pgTable, text, integer, bigint, bigserial, boolean, timestamp, uniqueIndex, jsonb, doublePrecision } from "drizzle-orm/pg-core";

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

/** One row per pending Monobank Corporate-API auth request (the
 *  deep-link-into-the-app connect flow — see monobank-corp-sign.ts). Kept
 *  separate from bankConnections since most rows here never become a real
 *  connection (declined, expired, abandoned tab): `id` doubles as the
 *  opaque token the client polls with, `proof` is the unguessable secret
 *  baked into the webhook URL Monobank calls back on. No userId here —
 *  same as bankConnections, one is minted fresh only once the request
 *  actually resolves into a connection. `encryptedToken` is set by the
 *  webhook (server-to-server, no browser cookies available) and consumed
 *  by the status route (which the browser polls and which DOES have a
 *  cookie jar to finish the connection into) — see completeMonobankConnection. */
export const monobankCorpAuthRequests = pgTable("monobank_corp_auth_requests", {
  id: text("id").primaryKey(),
  proof: text("proof").notNull(),
  monobankTokenRequestId: text("monobank_token_request_id"),
  status: text("status", { enum: ["pending", "confirmed", "expired"] }).notNull().default("pending"),
  encryptedToken: text("encrypted_token"),
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

/** Web Push — none of this reuses `users`/`userId`: that identity only
 *  exists once a Monobank connection is made (see the file-level comment
 *  above), and push has to work for someone who never connects a bank.
 *  `deviceId` is a separate, unencrypted random cookie (device-session.ts) —
 *  reminders are inherently per-installed-PWA, not per-account anyway. */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** A synced copy of only the calendar items that actually need a push —
 *  `reminder !== "none"` — written from calendar-store.ts on every add/
 *  update, deleted when a reminder is cleared or the item is removed. Not a
 *  general calendar sync: title/date/time/kind/reminder/recurrence is
 *  exactly what /api/push/send-reminders needs to recompute occurrences via
 *  the existing expandRecurringEvents (recurrence.ts), and nothing more. */
export const calendarReminderItems = pgTable("calendar_reminder_items", {
  id: text("id").primaryKey(), // same id as the client's CalendarItem
  deviceId: text("device_id").notNull(),
  title: text("title").notNull(),
  date: text("date").notNull(), // "YYYY-MM-DD"
  time: text("time"), // "HH:MM"
  kind: text("kind").notNull(), // "event" | "note"
  reminder: text("reminder").notNull(), // "10min" | "1hour" | "day"
  recurrence: jsonb("recurrence"), // EventRecurrence | null, as-is
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** One row per device that has ever touched sleep tracking — not just
 *  "bedtime reminder on" anymore. Carries both independent reminder times
 *  (either can be null = off) *and* the live sleep state, synced from
 *  startSleep/endSleep as well as the two setTarget*Time actions
 *  (health-store.ts's syncSleepSchedule) — /api/push/send-reminders needs
 *  sleepState to gate each reminder ("don't say 'time to sleep' if already
 *  sleeping", "don't say 'time to wake up' if the session never started"),
 *  and needs sessionStartedAt to do the "wake time is really tomorrow
 *  morning if earlier than bedtime" math and to dedupe the wake reminder
 *  per session rather than per calendar day. Always upserted, never
 *  deleted — a row with both times null and state "idle" is harmless, the
 *  cron just has nothing to do with it. */
export const bedtimeReminders = pgTable("bedtime_reminders", {
  deviceId: text("device_id").primaryKey(),
  // DB column stays "target_time" (its original name) — only the TS-side
  // property is renamed to targetBedtime for clarity paired with
  // targetWakeTime below. Keeping the column identifier unchanged turns
  // this into a plain "drop NOT NULL" diff instead of an ambiguous rename
  // drizzle-kit would otherwise need an interactive prompt to resolve.
  targetBedtime: text("target_time"), // "HH:MM", Europe/Kyiv wall-clock, null = off
  targetWakeTime: text("target_wake_time"), // "HH:MM", null = off
  sleepState: text("sleep_state").notNull().default("idle"), // "idle" | "sleeping"
  sessionStartedAt: timestamp("session_started_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** One row per device that has ever touched water tracking — same "always
 *  upserted, never deleted" shape as bedtimeReminders above, and for the
 *  same reason: the cron in /api/push/send-reminders has no access to this
 *  device's localStorage, so both the reminder settings AND a live copy of
 *  today's intake/goal have to be synced here (health-store.ts's
 *  syncWaterSchedule, called from addWater/setWaterGoal and the two
 *  settings actions). `todayDate` exists specifically so the cron can tell
 *  a genuinely-empty today apart from a stale snapshot nobody refreshed
 *  since yesterday — without it, a device that goes untouched overnight
 *  would keep showing as "already at yesterday's pace" and every reminder
 *  would silently (and wrongly) skip all day. */
export const waterReminders = pgTable("water_reminders", {
  deviceId: text("device_id").primaryKey(),
  remindersPerDay: integer("reminders_per_day").notNull().default(5),
  activeStart: text("active_start").notNull().default("09:00"), // "HH:MM", Europe/Kyiv wall-clock
  activeEnd: text("active_end").notNull().default("22:00"),
  todayAmountMl: integer("today_amount_ml").notNull().default(0),
  todayGoalMl: integer("today_goal_ml").notNull().default(2000),
  todayDate: text("today_date"), // "YYYY-MM-DD" the two fields above actually belong to; null before the first sync
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Dedup is a database-level guarantee here too, same as
 *  ledgerTransactions above: two overlapping cron ticks (or a retry) racing
 *  to send the same occurrence both attempt the insert, only one can win the
 *  unique constraint, and only the winner sends the push. `occurrenceKey` is
 *  "<itemId>|<fireAt ISO>" — distinct per occurrence of a recurring item.
 *  Reused for bedtime reminders too (itemId = "bedtime:<deviceId>",
 *  occurrenceKey = today's date) — same one-send-per-occurrence guarantee,
 *  no need for a parallel dedup mechanism. */
export const sentReminderLog = pgTable(
  "sent_reminder_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    itemId: text("item_id").notNull(),
    occurrenceKey: text("occurrence_key").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("sent_reminder_log_item_occurrence_idx").on(table.itemId, table.occurrenceKey)]
);

/** "Що рухає твої ринки" news cache — `id` is sha256(url) (see
 *  news/dedupe.ts), so re-fetching a URL Alpha Vantage has already served
 *  is a plain upsert instead of a separate lookup-then-insert step; that's
 *  the entire dedup-by-URL requirement. `markets`/`tickers` are the app's
 *  own normalized tags, not Alpha Vantage's raw topic/ticker-sentiment
 *  shape — see news/alpha-vantage-provider.ts for that mapping. Never
 *  stores full article text, only what the feed UI actually shows. */
export const newsItems = pgTable("news_items", {
  id: text("id").primaryKey(),
  headline: text("headline").notNull(),
  source: text("source").notNull(),
  url: text("url").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  summary: text("summary"),
  sentiment: text("sentiment"), // "positive" | "neutral" | "negative" | null
  markets: jsonb("markets").notNull().$type<string[]>(),
  tickers: jsonb("tickers").notNull().$type<string[]>(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Custom tickers a device has opted into beyond the four standard markets
 *  (see news-preferences-store.ts) — synced here so /api/news/refresh (a
 *  cron job with no access to any device's localStorage) knows which extra
 *  tickers to fetch from Alpha Vantage. Same "always upserted, one row per
 *  device" shape as bedtimeReminders/waterReminders above; refresh reads
 *  every row and fetches the union across all devices. */
export const newsTrackedTickers = pgTable("news_tracked_tickers", {
  deviceId: text("device_id").primaryKey(),
  tickers: jsonb("tickers").notNull().$type<string[]>().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** "Команди" — cross-device team feature (chat, shared XP, small group
 *  projects) for the трейдер/студент profiles. The app has no accounts
 *  system anywhere else (see device-session.ts) — a team is deliberately a
 *  lightweight "room" identified by its own id, which doubles as the invite
 *  code: whoever is given the code can join under any display name they
 *  type in. Not a security boundary (nothing sensitive is exposed beyond
 *  what members choose to post), just enough friction that joining
 *  requires having actually been given the code. */
export const teams = pgTable("teams", {
  id: text("id").primaryKey(), // the invite code itself, e.g. "K7QX9M"
  name: text("name").notNull(),
  profile: text("profile").notNull(), // "trader" | "student" | "it" — drives copy only, same schema
  rivalTeamId: text("rival_team_id"), // opposing team for "товариський виклик" — one-directional, no join table needed
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    deviceId: text("device_id").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull().default("member"), // "admin" | "member" — creator is admin
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("team_members_team_device_idx").on(table.teamId, table.deviceId)]
);

/** "Час команди" — team chat. Denormalizes displayName at send time (not
 *  joined from teamMembers on read) so a later name change or departure
 *  never rewrites history that already happened under the old name. */
export const teamMessages = pgTable("team_messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  deviceId: text("device_id").notNull(),
  displayName: text("display_name").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** "Стрічка команди" — auto-generated, one row per real action (join a
 *  trade closed, a study session logged, a project part updated, a note
 *  posted), never hand-typed. Written alongside a teamXpEvents row by the
 *  same award call for anything that earns XP; see teams/db.ts. */
export const teamActivity = pgTable("team_activity", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  deviceId: text("device_id").notNull(),
  displayName: text("display_name").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Logged as individual events rather than an incrementing counter column —
 *  ratings need both an all-time total and a "this week" total, and summing
 *  events on read (small per-team volume) avoids a second write path that
 *  could drift from the log. */
export const teamXpEvents = pgTable("team_xp_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  deviceId: text("device_id").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** "Спільні проєкти" — one flexible table for every kind rather than one
 *  table per kind: `data` carries kind-specific shape (`session`:
 *  {weekday, time}; `parts_project`: {parts: [{id,name,assigneeDeviceId,
 *  assigneeName,status}]}); `note` and `shared_deck` keep their content in
 *  the two child tables below instead, since those need indexed per-row
 *  queries (entries list, per-member card reviews) that jsonb wouldn't
 *  serve well. */
export const teamProjects = pgTable("team_projects", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  kind: text("kind").notNull(), // "note" | "session" | "parts_project" | "shared_deck"
  name: text("name").notNull(),
  status: text("status"), // short human status line shown in the project list
  data: jsonb("data").notNull().$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Chronological additions to a "note" project (e.g. a trader's shared
 *  weekly-strategy doc) — same shape as teamActivity but scoped to one
 *  project instead of the whole team. */
export const teamProjectEntries = pgTable("team_project_entries", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => teamProjects.id),
  deviceId: text("device_id").notNull(),
  displayName: text("display_name").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Cards in a "shared_deck" project — one deck shared by the whole team;
 *  any member can add a card, but each member reviews (and gets scheduled)
 *  independently — see teamDeckReviews. */
export const teamDeckCards = pgTable("team_deck_cards", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => teamProjects.id),
  front: text("front").notNull(),
  back: text("back").notNull(),
  addedByDeviceId: text("added_by_device_id").notNull(),
  addedByName: text("added_by_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Per-(card, device) SM-2 state — same algorithm and field shapes as the
 *  personal flashcard deck in student-store.ts (src/lib/sm2.ts), just
 *  persisted server-side since a shared deck has no single "owning" device.
 *  `dueDate` is a plain YYYY-MM-DD key, matching student-store's dateKey
 *  convention, not a timestamp — spaced repetition here is day-granularity. */
export const teamDeckReviews = pgTable(
  "team_deck_reviews",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => teamDeckCards.id),
    deviceId: text("device_id").notNull(),
    repetitions: integer("repetitions").notNull().default(0),
    easeFactor: doublePrecision("ease_factor").notNull().default(2.5),
    intervalDays: integer("interval_days").notNull().default(0),
    dueDate: text("due_date").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("team_deck_reviews_card_device_idx").on(table.cardId, table.deviceId)]
);
