import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  roleCompany: text("role_company"),
  email: text("email"),
  review: text("review").notNull(),
  status: text("status").$type<ReviewStatus>().notNull().default("pending"),
  userId: integer("user_id"),
  userIp: text("user_ip"),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});
