CREATE TABLE "ai_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"source_count" integer NOT NULL,
	"fallback" boolean DEFAULT false NOT NULL,
	"latency_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "cover_key" text;--> statement-breakpoint
CREATE INDEX "ai_questions_created_idx" ON "ai_questions" USING btree ("created_at");