ALTER TABLE "scans" ALTER COLUMN "user_email" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scans" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scans" ALTER COLUMN "plan_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "competitor_url" text;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "competitor_preview" json DEFAULT 'null'::json;