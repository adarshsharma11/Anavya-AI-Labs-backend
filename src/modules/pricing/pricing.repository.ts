import { db } from "../../db/db";
import { plans } from "../../db/schema";
import { eq, asc } from "drizzle-orm";

export const findActivePlans = async () => {
  return db
    .select()
    .from(plans)
    .where(eq(plans.active, true))
    .orderBy(asc(plans.price));
};

export const findPlanById = async (id: number) => {
  const result = await db
    .select()
    .from(plans)
    .where(eq(plans.id, id));

  return result[0];
};
