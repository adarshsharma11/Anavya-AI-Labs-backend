import { db } from "../../db/db";
import { scans } from "../../db/schema/scan";
import { eq } from "drizzle-orm";

export const createScanRepo = async (data: any) => {
  const res = await db.insert(scans).values(data).returning();
  return res[0];
};

export const updateScanRepo = async (id: number, data: any) => {
  await db.update(scans).set(data).where(eq(scans.id, id));
};

export const getScanRepo = async (id: number) => {
  const res = await db.select().from(scans).where(eq(scans.id, id));
  return res[0];
};
