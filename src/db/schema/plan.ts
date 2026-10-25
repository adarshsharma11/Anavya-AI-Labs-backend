import { pgTable, serial, text, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  slug: text("slug").unique(), // free | starter | pro

  name: text("name").notNull(),
  description: text("description"),

  price: integer("price").notNull(), // stored in cents
  compareAtPrice: integer("compare_at_price"),
  discountPercent: integer("discount_percent"),

  cadence: text("cadence"), // per month / per report etc
  type: text("type").notNull(), // free | one_time | subscription

  features: json("features").$type<string[]>(), // array of features
  cta: text("cta"),

  scanLimit: integer("scan_limit"), // scans per rolling 24h; null or -1 = unlimited
  whiteLabel: boolean("white_label").notNull().default(false),
  monitoring: boolean("monitoring").notNull().default(false),

  badge: text("badge"),
  isHighlighted: boolean("is_highlighted").default(false),

  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export type InsertPlan = typeof plans.$inferInsert;
