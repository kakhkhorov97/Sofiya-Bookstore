-- Won prices for existing formats: dollars x 1,400, rounded to the nearest
-- 100 won (same rule as suggestKrw() in packages/shared). Admins can change them.
ALTER TABLE "book_formats" ADD COLUMN "price_krw" integer;--> statement-breakpoint
UPDATE "book_formats" SET "price_krw" = GREATEST(100, ROUND("price_cents" * 1400 / 100.0 / 100.0) * 100);--> statement-breakpoint
ALTER TABLE "book_formats" ALTER COLUMN "price_krw" SET NOT NULL;--> statement-breakpoint
-- Orders placed before this change were charged in dollars.
ALTER TABLE "orders" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "book_formats" ADD CONSTRAINT "book_formats_price_krw_nonnegative" CHECK ("book_formats"."price_krw" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_known" CHECK ("orders"."currency" IN ('USD', 'KRW'));
