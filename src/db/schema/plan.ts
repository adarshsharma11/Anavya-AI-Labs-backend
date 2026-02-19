import { pgTable, serial, text, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),

  name: text("name").notNull(),
  description: text("description"),

  price: integer("price").notNull(), // stored in cents
  compareAtPrice: integer("compare_at_price"),
  discountPercent: integer("discount_percent"),

  cadence: text("cadence"), // per month / per report etc
  type: text("type").notNull(), // free | one_time | subscription

  features: json("features").$type<string[]>(), // array of features
  cta: text("cta"),

  scanLimit: integer("scan_limit"),

  badge: text("badge"),
  isHighlighted: boolean("is_highlighted").default(false),

  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export type InsertPlan = typeof plans.$inferInsert;
