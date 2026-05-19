CREATE TABLE "portfolio" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"tags" json NOT NULL,
	"image_url" text,
	"image_hint" text,
	"image_key" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "portfolio_slug_unique" UNIQUE("slug")
);
