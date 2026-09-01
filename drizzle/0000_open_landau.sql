CREATE TYPE "public"."document_status" AS ENUM('pending', 'sent', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"third_party_email" text NOT NULL,
	"file_url" text NOT NULL,
	"reason" text,
	"sent_at" timestamp with time zone,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "integration_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"document_id" uuid,
	"detail" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"status" "webhook_status" NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_document_status_unique" ON "webhook_events" USING btree ("document_id","status");