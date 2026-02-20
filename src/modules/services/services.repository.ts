import { db } from "../../db/db";
import { services, servicesPage } from "../../db/schema/services";

export const getServicesPageRepo = async () => {
  const page = await db.select().from(servicesPage).limit(1);
  return page[0];
};

export const getServicesRepo = async () => {
  return await db.select().from(services).orderBy(services.id);
};

export const createServiceRepo = async (data: any) => {
  const res = await db.insert(services).values(data).returning();
  return res[0];
};

export const createPageRepo = async (data:any)=>{
  const res = await db.insert(servicesPage).values(data).returning();
  return res[0];
};
