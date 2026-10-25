import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/** Razorpay plans have a fixed amount, so one is created per plan, currency and price. */
export const razorpayPlans = pgTable(
  "razorpay_plans",
  {
    id: serial("id").primaryKey(),
    planId: integer("plan_id").notNull(),
    currency: text("currency").notNull(),
    amountSubunits: integer("amount_subunits").notNull(),
    mode: text("mode").notNull(), // test | live
    razorpayPlanId: text("razorpay_plan_id").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [uniqueIndex("razorpay_plans_lookup_unique").on(t.planId, t.currency, t.amountSubunits, t.mode)],
);
