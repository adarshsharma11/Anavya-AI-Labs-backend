import { db } from "../../db/db";
import { services } from "../../db/schema/services";

export const getServicesRepo = async () => {
  return await db.select().from(services).orderBy(services.id);
};

export const createServiceRepo = async (data: any) => {
  const res = await db.insert(services).values(data).returning();
  return res[0];
};
