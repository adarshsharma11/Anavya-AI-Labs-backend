CREATE TABLE "scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"normalized_url" text,
	"status" text DEFAULT 'pending',
	"preview" json DEFAULT 'null'::json,
	"full_report" json DEFAULT 'null'::json,
	"is_unlocked" boolean DEFAULT false,
	"user_email" text DEFAULT null,
	"user_id" integer DEFAULT null,
	"user_ip" text,
	"plan_id" integer DEFAULT null,
	"created_at" timestamp DEFAULT now()
);
