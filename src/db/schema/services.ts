import { pgTable, serial, text, json, timestamp } from "drizzle-orm/pg-core";

export const services = pgTable("services", {
  id: serial("id").primaryKey(),

  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),

  icon: text("icon").notNull(),
  cta: json("cta").$type<{ label: string; href: string }>(),

  createdAt: timestamp("created_at").defaultNow(),
});
