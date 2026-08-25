CREATE TABLE "monobank_corp_auth_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"proof" text NOT NULL,
	"monobank_token_request_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"encrypted_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
