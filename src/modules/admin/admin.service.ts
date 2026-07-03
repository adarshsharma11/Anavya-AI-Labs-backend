import { db } from "../../db/db";
import { users } from "../../db/schema/user";
import { scans } from "../../db/schema/scan";
import { eq, desc, sql } from "drizzle-orm";

export const getAdminAnalyticsService = async () => {
  const [userCountResult] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const [scanCountResult] = await db.select({ count: sql<number>`count(*)::int` }).from(scans);

  const res = await db.execute(sql`
    SELECT 
      COALESCE(AVG((preview->'categories'->>'performance')::int), 0) as "avgPerformanceScore",
      COALESCE(AVG((preview->'categories'->>'seo')::int), 0) as "avgSeoScore",
      COALESCE(AVG((preview->'categories'->>'accessibility')::int), 0) as "avgAccessibilityScore",
      COALESCE(AVG((preview->'categories'->>'security')::int), 0) as "avgSecurityScore",
      COALESCE(SUM((preview->>'totalIssuesFound')::int), 0) as "totalIssuesFound"
    FROM scans
  `);

  const stats = res.rows[0] || {
    avgPerformanceScore: 0,
    avgSeoScore: 0,
    avgAccessibilityScore: 0,
    avgSecurityScore: 0,
    totalIssuesFound: 0
  };

  return {
    totalUsers: userCountResult?.count || 0,
    totalScans: scanCountResult?.count || 0,
    avgPerformanceScore: Math.round(Number(stats.avgPerformanceScore)),
    avgSeoScore: Math.round(Number(stats.avgSeoScore)),
    avgAccessibilityScore: Math.round(Number(stats.avgAccessibilityScore)),
    avgSecurityScore: Math.round(Number(stats.avgSecurityScore)),
    totalIssuesFound: Number(stats.totalIssuesFound),
  };
};

export const getAdminUsersService = async () => {
  return await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    username: users.username,
    role: users.role,
    companyName: users.companyName,
    companyLogoUrl: users.companyLogoUrl,
    phoneNumber: users.phoneNumber,
    createdAt: users.createdAt,
    scanCount: sql<number>`(SELECT count(*)::int FROM scans WHERE scans.user_id = users.id)`
  })
  .from(users)
  .orderBy(desc(users.createdAt));
};

export const deleteUserService = async (userId: number) => {
  // Check if user is an admin - do not allow self-deletion or deletion of other admins
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (user?.role === "admin") {
    throw new Error("Cannot delete an administrative user");
  }
  
  // Set userId of scans to null to prevent foreign key errors and retain the records
  await db.update(scans).set({ userId: null }).where(eq(scans.userId, userId));
  
  const [deleted] = await db.delete(users).where(eq(users.id, userId)).returning();
  return deleted;
};

export const getAdminScansService = async () => {
  return await db.select({
    id: scans.id,
    url: scans.url,
    competitorUrl: scans.competitorUrl,
    status: scans.status,
    isUnlocked: scans.isUnlocked,
    createdAt: scans.createdAt,
    userEmail: scans.userEmail,
    userId: scans.userId,
    userIp: scans.userIp,
    overall: sql<number>`COALESCE((preview->>'overall')::int, 0)`,
    userName: users.name,
  })
  .from(scans)
  .leftJoin(users, eq(scans.userId, users.id))
  .orderBy(desc(scans.createdAt));
};
