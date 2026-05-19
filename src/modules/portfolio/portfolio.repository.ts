import { eq } from "drizzle-orm";
import { db } from "../../db/db";
import { portfolio } from "../../db/schema/portfolio";

export const getPortfolioRepo = async () => {
  return await db.select().from(portfolio).orderBy(portfolio.createdAt);
};

export const getPortfolioBySlugRepo = async (slug: string) => {
  const res = await db.select().from(portfolio).where(eq(portfolio.slug, slug)).limit(1);
  return res[0];
};

export const createPortfolioRepo = async (data: any) => {
  const res = await db.insert(portfolio).values(data).returning();
  return res[0];
};

export const updatePortfolioRepo = async (slug: string, data: any) => {
  const res = await db.update(portfolio).set(data).where(eq(portfolio.slug, slug)).returning();
  return res[0];
};

export const deletePortfolioRepo = async (slug: string) => {
  const res = await db.delete(portfolio).where(eq(portfolio.slug, slug)).returning();
  return res[0];
};
