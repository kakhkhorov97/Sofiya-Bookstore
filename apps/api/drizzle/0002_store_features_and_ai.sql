CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "book_embeddings" (
	"book_id" uuid PRIMARY KEY NOT NULL,
	"embedding" vector(768) NOT NULL,
	"content_hash" text NOT NULL,
	"model" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "wishlist" (
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_user_id_book_id_pk" PRIMARY KEY("user_id","book_id")
);
--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "author_slug" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "staff_pick_note" text;--> statement-breakpoint
ALTER TABLE "book_embeddings" ADD CONSTRAINT "book_embeddings_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_embeddings_hnsw_idx" ON "book_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_email_lower_key" ON "newsletter_subscribers" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_user_book_key" ON "reviews" USING btree ("user_id","book_id");--> statement-breakpoint
CREATE INDEX "reviews_book_idx" ON "reviews" USING btree ("book_id","created_at");--> statement-breakpoint
CREATE INDEX "books_author_slug_idx" ON "books" USING btree ("author_slug");