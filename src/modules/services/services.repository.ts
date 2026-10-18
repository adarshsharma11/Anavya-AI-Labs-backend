import { db } from "../../db/db.js";
import { services } from "../../db/schema/services.js";
import { eq } from "drizzle-orm";

export const getServicesRepo = async () => {
  return await db.select().from(services).orderBy(services.id);
};

export const createServiceRepo = async (data: any) => {
  const res = await db.insert(services).values(data).returning();
  return res[0];
};

export const updateServiceRepo = async (id: number, data: Partial<typeof services.$inferInsert>) => {
  const [res] = await db.update(services).set(data).where(eq(services.id, id)).returning();
  return res;
};

export const deleteServiceRepo = async (id: number) => {
  await db.delete(services).where(eq(services.id, id));
};
