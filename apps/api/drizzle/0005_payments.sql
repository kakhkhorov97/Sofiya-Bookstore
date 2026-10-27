ALTER TABLE "orders" ADD COLUMN "payment_method" text DEFAULT 'BANK_TRANSFER' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" text DEFAULT 'UNPAID' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_key" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "receipt_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_error" text;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_payment_key" ON "orders" USING btree ("payment_key");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_method_known" CHECK ("orders"."payment_method" IN ('CARD', 'BANK_TRANSFER'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_status_known" CHECK ("orders"."payment_status" IN ('UNPAID', 'CONFIRMING', 'PAID', 'REFUNDED'));--> statement-breakpoint
-- Orders confirmed before payments existed were paid outside the site.
UPDATE "orders" SET "payment_status" = 'PAID', "paid_at" = "updated_at" WHERE "status" IN ('IN_PROCESS', 'DELIVERED');