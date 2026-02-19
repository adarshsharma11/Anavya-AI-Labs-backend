import { pgTable, serial, text, boolean, timestamp, json, integer } from "drizzle-orm/pg-core";

export const scans = pgTable("scans", {
  id: serial("id").primaryKey(),

  url: text("url").notNull(),
  normalizedUrl: text("normalized_url"),

  status: text("status").default("pending"),

  preview: json("preview").$type<any>().default(null),
  competitorUrl: text("competitor_url"),
  competitorPreview: json("competitor_preview").$type<any>().default(null),
  competitorAnalysis: json("competitor_analysis").$type<any>().default(null),

  fullReport: json("full_report").$type<any>().default(null),

  isUnlocked: boolean("is_unlocked").default(false),

  userEmail: text("user_email"),
  userId: integer("user_id"),

  userIp: text("user_ip"),
  planId: integer("plan_id"),

  createdAt: timestamp("created_at").defaultNow(),
});
