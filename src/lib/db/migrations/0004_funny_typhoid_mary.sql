CREATE TABLE "calendar_reminder_items" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"time" text,
	"kind" text NOT NULL,
	"reminder" text NOT NULL,
	"recurrence" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "sent_reminder_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"occurrence_key" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sent_reminder_log_item_occurrence_idx" ON "sent_reminder_log" USING btree ("item_id","occurrence_key");