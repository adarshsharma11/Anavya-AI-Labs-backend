import { pgTable, serial, text, integer, json, timestamp } from "drizzle-orm/pg-core";

export const geoChecks = pgTable("geo_checks", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  email: text("email"),
  userId: integer("user_id"),
  userIp: text("user_ip"),
  score: integer("score").notNull(),
  result: json("result").$type<any>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
