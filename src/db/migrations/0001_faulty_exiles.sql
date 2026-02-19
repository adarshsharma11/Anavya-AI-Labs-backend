ALTER TABLE "plans" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "compare_at_price" integer;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "discount_percent" integer;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "is_highlighted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "badge" text;