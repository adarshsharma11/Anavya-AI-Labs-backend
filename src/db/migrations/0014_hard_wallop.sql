CREATE TABLE "about" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"badges" json NOT NULL,
	"image_url" text NOT NULL,
	"image_hint" text,
	"highlights" json NOT NULL,
	"principles" json NOT NULL,
	"culture" json NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
