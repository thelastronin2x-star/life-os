CREATE TABLE "macro_events" (
	"id" text PRIMARY KEY NOT NULL,
	"region" text NOT NULL,
	"currency" text NOT NULL,
	"title" text NOT NULL,
	"importance" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"previous" text,
	"actual" text,
	"source_url" text,
	"affected_markets" jsonb NOT NULL,
	"provider" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
