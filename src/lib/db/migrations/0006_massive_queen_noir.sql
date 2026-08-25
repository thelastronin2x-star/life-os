ALTER TABLE "bedtime_reminders" ALTER COLUMN "target_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bedtime_reminders" ADD COLUMN "target_wake_time" text;--> statement-breakpoint
ALTER TABLE "bedtime_reminders" ADD COLUMN "sleep_state" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "bedtime_reminders" ADD COLUMN "session_started_at" timestamp with time zone;