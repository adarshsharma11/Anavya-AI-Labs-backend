import { pgTable, serial, text, json, timestamp } from "drizzle-orm/pg-core";

export const servicesPage = pgTable("services_page", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),

  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),

  icon: text("icon").notNull(),
  cta: json("cta").$type<{ label: string; href: string }>(),

  createdAt: timestamp("created_at").defaultNow(),
});
