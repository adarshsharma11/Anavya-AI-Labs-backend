import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/db.js";
import { blogs } from "../../db/schema/blogs.js";

export const getBlogsRepo = async () => {
  return await db.select().from(blogs).where(eq(blogs.status, "published")).orderBy(blogs.createdAt);
};

export const getAllBlogsRepo = async () => {
  return await db.select().from(blogs).orderBy(desc(blogs.createdAt));
};

export const getPublishedBlogBySlugRepo = async (slug: string) => {
  const res = await db
    .select()
    .from(blogs)
    .where(and(eq(blogs.slug, slug), eq(blogs.status, "published")))
    .limit(1);
  return res[0];
};

export const getBlogBySlugRepo = async (slug: string) => {
  const res = await db.select().from(blogs).where(eq(blogs.slug, slug)).limit(1);
  return res[0];
};

export const createBlogRepo = async (data: any) => {
  const res = await db.insert(blogs).values(data).returning();
  return res[0];
};

export const updateBlogRepo = async (slug: string, data: any) => {
  const res = await db.update(blogs).set({ ...data, updatedAt: new Date() }).where(eq(blogs.slug, slug)).returning();
  return res[0];
};

export const deleteBlogRepo = async (slug: string) => {
  const res = await db.delete(blogs).where(eq(blogs.slug, slug)).returning();
  return res[0];
};
