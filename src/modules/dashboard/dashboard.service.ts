import { db } from "../../db/db";
import { users } from "../../db/schema/user";
import { scans } from "../../db/schema/scan";
import { eq, desc } from "drizzle-orm";

export const getProfileService = async (userId: number) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { password: false }
  });
  if (!user) throw new Error("User not found");
  return user;
};

export const updateProfileService = async (userId: number, data: any) => {
  // Allowed updates
  const { name, companyName, companyLogoUrl, phoneNumber } = data;
  const updatePayload: any = {};
  if (name !== undefined) updatePayload.name = name;
  if (companyName !== undefined) updatePayload.companyName = companyName;
  if (companyLogoUrl !== undefined) updatePayload.companyLogoUrl = companyLogoUrl;
  if (phoneNumber !== undefined) updatePayload.phoneNumber = phoneNumber;

  const [updated] = await db.update(users)
    .set(updatePayload)
    .where(eq(users.id, userId))
    .returning();
  
  if (!updated) throw new Error("Update failed");
  // Don't return password
  const { password, ...safeUser } = updated;
  return safeUser;
};

export const getUserScansService = async (userId: number) => {
  return await db.query.scans.findMany({
    where: eq(scans.userId, userId),
    orderBy: [desc(scans.createdAt)],
  });
};

export const getUserAnalyticsService = async (userId: number) => {
  const userScans = await getUserScansService(userId);
  const totalScans = userScans.length;
  // Compute some basic mock or actual trends
  // E.g., average performance score
  let avgPerformance = 0;
  if (totalScans > 0) {
    const scores = userScans.map(s => s.preview?.categories?.performance || 0);
    avgPerformance = scores.reduce((a, b) => a + Number(b), 0) / totalScans;
  }

  return {
    totalScans,
    averagePerformanceScore: Math.round(avgPerformance),
    recentActivity: userScans.slice(0, 5) // Last 5
  };
};
