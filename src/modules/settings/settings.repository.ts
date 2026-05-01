import { eq } from "drizzle-orm";
import { db } from "../../db/db";
import { settings } from "../../db/schema/settings";

export const getSettingsRepo = async () => {
  return await db.select().from(settings);
};

export const getSettingByKeyRepo = async (key: string) => {
  const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return result[0] || null;
};

export const upsertSettingRepo = async (key: string, value: string) => {
  const existing = await getSettingByKeyRepo(key);
  if (existing) {
    const updated = await db
      .update(settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(settings.key, key))
      .returning();
    return updated[0];
  } else {
    const inserted = await db
      .insert(settings)
      .values({ key, value })
      .returning();
    return inserted[0];
  }
};
