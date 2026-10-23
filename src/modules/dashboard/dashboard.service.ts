import { db } from "../../db/db.js";
import { users } from "../../db/schema/user.js";
import { scans } from "../../db/schema/scan.js";
import { eq, desc, sql } from "drizzle-orm";

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
  return await db
    .select({
      id: scans.id,
      publicId: scans.publicId,
      url: scans.url,
      competitorUrl: scans.competitorUrl,
      status: scans.status,
      isUnlocked: scans.isUnlocked,
      hasFullReport: sql<boolean>`${scans.fullReport} IS NOT NULL`,
      overall: sql<number | null>`(${scans.preview}->>'overall')::int`,
      verdict: sql<string | null>`${scans.preview}->>'verdict'`,
      categories: sql<Record<string, number | null> | null>`${scans.preview}->'categories'`,
      reportVersion: sql<number>`COALESCE((${scans.preview}->>'version')::int, 1)`,
      createdAt: scans.createdAt,
    })
    .from(scans)
    .where(eq(scans.userId, userId))
    .orderBy(desc(scans.createdAt));
};

export const getUserAnalyticsService = async (userId: number) => {
  const userScans = await getUserScansService(userId);
  
  const res = await db.execute(sql`
    SELECT 
      COALESCE(COUNT(*), 0) as "totalScans",
      COALESCE(AVG((preview->>'overall')::int), 0) as "avgOverallScore",
      COALESCE(AVG(COALESCE(preview->'categories'->>'speed', preview->'categories'->>'performance')::int), 0) as "avgPerformanceScore",
      COALESCE(AVG(COALESCE(preview->'categories'->>'technical', preview->'categories'->>'seo')::int), 0) as "avgSeoScore",
      COALESCE(AVG((preview->'categories'->>'aeo')::int), 0) as "avgAeoScore",
      COALESCE(AVG((preview->'categories'->>'geo')::int), 0) as "avgGeoScore",
      COALESCE(SUM((preview->>'totalIssuesFound')::int), 0) as "totalIssuesFound"
    FROM scans
    WHERE user_id = ${userId}
  `);

  const analytics = res.rows[0] ?? {};
  const avg = (key: string) => Math.round(Number(analytics[key] ?? 0));

  return {
    totalScans: Number(analytics.totalScans ?? 0),
    avgOverallScore: avg("avgOverallScore"),
    avgPerformanceScore: avg("avgPerformanceScore"),
    avgSeoScore: avg("avgSeoScore"),
    avgAeoScore: avg("avgAeoScore"),
    avgGeoScore: avg("avgGeoScore"),
    totalIssuesFound: Number(analytics.totalIssuesFound ?? 0),
    recentActivity: userScans.slice(0, 5)
  };
};
