import { db } from "../../db/db";
import { contacts } from "../../db/schema/contact";

export const createContactRepo = async (data: any) => {
  const res = await db.insert(contacts).values(data).returning();
  return res[0];
};

export const getContactsRepo = async () => {
  return await db.select().from(contacts).orderBy(contacts.createdAt);
};
