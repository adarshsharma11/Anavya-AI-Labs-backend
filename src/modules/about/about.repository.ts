import { db } from "../../db/db";
import { about } from "../../db/schema/about";
import { desc } from "drizzle-orm";

export const getAboutRepo = async () => {
  return await db.select().from(about).orderBy(desc(about.id));
};

export const createAboutRepo = async (data: any) => {
  const res = await db.insert(about).values(data).returning();
  return res[0];
};
