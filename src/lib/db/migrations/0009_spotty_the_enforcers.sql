CREATE TABLE "news_items" (
	"id" text PRIMARY KEY NOT NULL,
	"headline" text NOT NULL,
	"source" text NOT NULL,
	"url" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"summary" text,
	"sentiment" text,
	"markets" jsonb NOT NULL,
	"tickers" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_tracked_tickers" (
	"device_id" text PRIMARY KEY NOT NULL,
	"tickers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
