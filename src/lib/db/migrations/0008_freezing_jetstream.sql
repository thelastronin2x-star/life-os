CREATE TABLE "water_reminders" (
	"device_id" text PRIMARY KEY NOT NULL,
	"reminders_per_day" integer DEFAULT 5 NOT NULL,
	"active_start" text DEFAULT '09:00' NOT NULL,
	"active_end" text DEFAULT '22:00' NOT NULL,
	"today_amount_ml" integer DEFAULT 0 NOT NULL,
	"today_goal_ml" integer DEFAULT 2000 NOT NULL,
	"today_date" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
