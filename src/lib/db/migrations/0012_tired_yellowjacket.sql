CREATE TABLE "apple_pay_tokens" (
	"device_id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apple_pay_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pending_apple_pay_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"amount" double precision NOT NULL,
	"merchant" text NOT NULL,
	"transaction_date" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pending_apple_pay_dedup_idx" ON "pending_apple_pay_transactions" USING btree ("device_id","amount","merchant","transaction_date");