CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"callback_url" text NOT NULL,
	"status" "webhook_status" NOT NULL,
	"delivered" boolean NOT NULL,
	"attempts" integer NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
