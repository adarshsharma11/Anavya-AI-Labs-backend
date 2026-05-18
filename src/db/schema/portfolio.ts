import { pgTable, serial, text, json, timestamp } from "drizzle-orm/pg-core";

export const portfolio = pgTable("portfolio", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  tags: json("tags").$type<string[]>().notNull(),
  imageUrl: text("image_url"),
  imageHint: text("image_hint"),
  imageKey: text("image_key").notNull(), // maps to e.g. "portfolio-1"
  createdAt: timestamp("created_at").defaultNow(),
});
