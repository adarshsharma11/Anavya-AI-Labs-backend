import { eq } from "drizzle-orm";
import { db } from "../../db/db";
import { pages } from "../../db/schema/pages";

export const getPageBySlugRepo = async (slug: string) => {
  const page = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
  return page.length > 0 ? page[0] : null;
};

export const createPageRepo = async (data: any) => {
  const res = await db.insert(pages).values(data).returning();
  return res[0];
};

export const updatePageRepo = async (slug: string, data: any) => {
  const res = await db.update(pages).set({ ...data, updatedAt: new Date() }).where(eq(pages.slug, slug)).returning();
  return res.length > 0 ? res[0] : null;
};
