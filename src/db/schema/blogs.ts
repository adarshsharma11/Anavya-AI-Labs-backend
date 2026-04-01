import { pgTable, serial, text, json, timestamp } from "drizzle-orm/pg-core";

export const blogs = pgTable("blogs", {
  id: serial("id").primaryKey(),

  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  
  category: text("category").notNull(),
  date: text("date").notNull(),
  readTime: text("read_time").notNull(),
  
  image: text("image").notNull(),
  
  authorName: text("author_name").notNull(),
  authorRole: text("author_role").notNull(),
  authorAvatar: text("author_avatar").notNull(),

  tags: json("tags").$type<string[]>().notNull(),
  content: json("content").$type<string[]>().notNull(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
