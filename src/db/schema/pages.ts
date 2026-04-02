import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  content: text("content"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
