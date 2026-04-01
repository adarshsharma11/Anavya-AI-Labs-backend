CREATE TABLE "blogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"category" text NOT NULL,
	"date" text NOT NULL,
	"read_time" text NOT NULL,
	"image" text NOT NULL,
	"author_name" text NOT NULL,
	"author_role" text NOT NULL,
	"author_avatar" text NOT NULL,
	"tags" json NOT NULL,
	"content" json NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "blogs_slug_unique" UNIQUE("slug")
);
