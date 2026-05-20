import { pgTable, serial, text, json, timestamp } from "drizzle-orm/pg-core";

export const about = pgTable("about", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  badges: json("badges").$type<string[]>().notNull(),
  imageUrl: text("image_url").notNull(),
  imageHint: text("image_hint"),
  highlights: json("highlights").$type<{ value: string; label: string; detail: string }[]>().notNull(),
  principles: json("principles").$type<{ title: string; description: string }[]>().notNull(),
  culture: json("culture").$type<{ title: string; description: string }[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
