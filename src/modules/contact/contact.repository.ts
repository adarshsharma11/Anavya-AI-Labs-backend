import { db } from "../../db/db.js";
import { contacts } from "../../db/schema/contact.js";
import { eq } from "drizzle-orm";

export const createContactRepo = async (data: any) => {
  const res = await db.insert(contacts).values(data).returning();
  return res[0];
};

export const getContactsRepo = async () => {
  return await db.select().from(contacts).orderBy(contacts.createdAt);
};

export const updateContactRepo = async (id: number, data: Partial<typeof contacts.$inferInsert>) => {
  const [res] = await db.update(contacts).set(data).where(eq(contacts.id, id)).returning();
  return res;
};

export const deleteContactRepo = async (id: number) => {
  await db.delete(contacts).where(eq(contacts.id, id));
};
