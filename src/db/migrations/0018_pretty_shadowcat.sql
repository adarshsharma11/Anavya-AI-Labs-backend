CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"scan_id" integer,
	"user_id" integer,
	"subscription_id" integer,
	"razorpay_order_id" text,
	"razorpay_payment_id" text NOT NULL,
	"amount_subunits" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"email" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payments_razorpay_payment_id_unique" UNIQUE("razorpay_payment_id")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"email" text,
	"user_id" integer,
	"user_ip" text,
	"score" integer NOT NULL,
	"result" json NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "monitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"url" text NOT NULL,
	"last_scan_id" integer,
	"last_score" integer,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_pdfs" (
	"scan_id" integer NOT NULL,
	"variant" text NOT NULL,
	"content_base64" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "report_pdfs_scan_id_variant_pk" PRIMARY KEY("scan_id","variant")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role_company" text,
	"email" text,
	"review" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_id" integer,
	"user_ip" text,
	"created_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "razorpay_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"currency" text NOT NULL,
	"amount_subunits" integer NOT NULL,
	"mode" text NOT NULL,
	"razorpay_plan_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "razorpay_plans_razorpay_plan_id_unique" UNIQUE("razorpay_plan_id")
);
--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "white_label" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "monitoring" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "razorpay_sub_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "public_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "report_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "blogs" ADD COLUMN "status" text DEFAULT 'published' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "razorpay_plans_lookup_unique" ON "razorpay_plans" USING btree ("plan_id","currency","amount_subunits","mode");--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_razorpay_sub_id_unique" UNIQUE("razorpay_sub_id");--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_public_id_unique" UNIQUE("public_id");