CREATE TYPE "public"."book_format" AS ENUM('HARDCOVER', 'PAPERBACK', 'EBOOK', 'AUDIOBOOK');--> statement-breakpoint
CREATE TYPE "public"."book_status" AS ENUM('DRAFT', 'LIVE', 'PAUSED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."genre" AS ENUM('FICTION', 'ROMANCE', 'FANTASY', 'MYSTERY', 'SCIENCE_FICTION', 'HORROR', 'HISTORY', 'SELF_HELP', 'PROGRAMMING');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PAUSED', 'IN_PROCESS', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'BLOCKED', 'DELETED');--> statement-breakpoint
CREATE TABLE "book_formats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"format" "book_format" NOT NULL,
	"price_cents" integer NOT NULL,
	"stock" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_formats_price_nonnegative" CHECK ("book_formats"."price_cents" >= 0),
	CONSTRAINT "book_formats_stock_nonnegative" CHECK ("book_formats"."stock" IS NULL OR "book_formats"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"genre" "genre" NOT NULL,
	"description" text NOT NULL,
	"pages" integer,
	"published_year" integer,
	"language" text DEFAULT 'English' NOT NULL,
	"status" "book_status" DEFAULT 'DRAFT' NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') || setweight(to_tsvector('english'::regconfig, coalesce(author, '')), 'A') || setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'B')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "books_pages_positive" CHECK ("books"."pages" IS NULL OR "books"."pages" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"format_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'PAUSED' NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"delivery_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_total_matches" CHECK ("orders"."total_cents" = "orders"."subtotal_cents" + "orders"."delivery_cents")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_points_nonnegative" CHECK ("users"."points" >= 0)
);
--> statement-breakpoint
ALTER TABLE "book_formats" ADD CONSTRAINT "book_formats_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_format_id_book_formats_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."book_formats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "book_formats_book_format_key" ON "book_formats" USING btree ("book_id","format");--> statement-breakpoint
CREATE UNIQUE INDEX "books_slug_key" ON "books" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "books_genre_status_idx" ON "books" USING btree ("genre","status");--> statement-breakpoint
CREATE INDEX "books_search_idx" ON "books" USING gin ("search");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_user_idempotency_key" ON "orders" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "orders_user_status_idx" ON "orders" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" USING btree (lower("email"));