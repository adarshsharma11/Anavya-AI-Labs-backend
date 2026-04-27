import { db } from "../../db/db";
import { users } from "../../db/schema/user";
import { otps, refreshTokens } from "../../db/schema/auth";
import { eq, and, gt } from "drizzle-orm";

// -- USER --
export const getUserByEmail = async (email: string) => {
  return await db.query.users.findFirst({ where: eq(users.email, email) });
};

export const getUserById = async (id: number) => {
  return await db.query.users.findFirst({ where: eq(users.id, id) });
};

export const createUserRepo = async (data: typeof users.$inferInsert) => {
  const [created] = await db.insert(users).values(data).returning();
  return created;
};

export const updateUserRepo = async (id: number, data: Partial<typeof users.$inferInsert>) => {
  const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
  return updated;
};

// -- OTP --
export const createOtpRepo = async (data: typeof otps.$inferInsert) => {
  const [created] = await db.insert(otps).values(data).returning();
  return created;
};

export const getValidOtp = async (email: string, otpCode: string, type: string) => {
  const now = new Date();
  return await db.query.otps.findFirst({
    where: and(
      eq(otps.email, email),
      eq(otps.otp, otpCode),
      eq(otps.type, type),
      gt(otps.expiresAt, now)
    )
  });
};

export const deleteOtp = async (id: number) => {
  await db.delete(otps).where(eq(otps.id, id));
};

// -- REFRESH TOKENS --
export const createRefreshToken = async (data: typeof refreshTokens.$inferInsert) => {
  const [created] = await db.insert(refreshTokens).values(data).returning();
  return created;
};

export const getRefreshToken = async (token: string) => {
  return await db.query.refreshTokens.findFirst({ where: eq(refreshTokens.token, token) });
};

export const deleteRefreshToken = async (token: string) => {
  await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
};
