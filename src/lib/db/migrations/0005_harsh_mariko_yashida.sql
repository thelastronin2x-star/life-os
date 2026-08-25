CREATE TABLE "bedtime_reminders" (
	"device_id" text PRIMARY KEY NOT NULL,
	"target_time" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
