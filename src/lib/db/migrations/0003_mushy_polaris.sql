CREATE TABLE "backfill_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_link_id" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"cursor_seconds" bigint NOT NULL,
	"windows_processed" integer DEFAULT 0 NOT NULL,
	"history_exhausted" boolean DEFAULT false NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "balance_snapshots" ADD COLUMN "source" text DEFAULT 'transaction-event' NOT NULL;--> statement-breakpoint
ALTER TABLE "backfill_jobs" ADD CONSTRAINT "backfill_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backfill_jobs" ADD CONSTRAINT "backfill_jobs_account_link_id_bank_account_links_id_fk" FOREIGN KEY ("account_link_id") REFERENCES "public"."bank_account_links"("id") ON DELETE no action ON UPDATE no action;