CREATE TABLE "team_activity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"device_id" text NOT NULL,
	"display_name" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_deck_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"added_by_device_id" text NOT NULL,
	"added_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_deck_reviews" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"device_id" text NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"ease_factor" double precision DEFAULT 2.5 NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"due_date" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"device_id" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"device_id" text NOT NULL,
	"display_name" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_project_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"device_id" text NOT NULL,
	"display_name" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"status" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_xp_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"device_id" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"profile" text NOT NULL,
	"rival_team_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_activity" ADD CONSTRAINT "team_activity_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_deck_cards" ADD CONSTRAINT "team_deck_cards_project_id_team_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."team_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_deck_reviews" ADD CONSTRAINT "team_deck_reviews_card_id_team_deck_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."team_deck_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_project_entries" ADD CONSTRAINT "team_project_entries_project_id_team_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."team_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_projects" ADD CONSTRAINT "team_projects_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_xp_events" ADD CONSTRAINT "team_xp_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_deck_reviews_card_device_idx" ON "team_deck_reviews" USING btree ("card_id","device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_device_idx" ON "team_members" USING btree ("team_id","device_id");