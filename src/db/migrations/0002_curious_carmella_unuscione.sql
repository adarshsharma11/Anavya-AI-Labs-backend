ALTER TABLE "plans" ADD COLUMN "cadence" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "features" json;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "cta" text;--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN "interval";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN "stripe_price_id";