import { db } from "../../db/db.js";
import { users } from "../../db/schema/user.js";
import { scans } from "../../db/schema/scan.js";
import { payments } from "../../db/schema/payments.js";
import { eq, desc, sql } from "drizzle-orm";
import { STUCK_REPORT_MINUTES } from "../scan/scan.repository.js";

export const getAdminAnalyticsService = async () => {
  const [userCountResult] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const [scanCountResult] = await db.select({ count: sql<number>`count(*)::int` }).from(scans);

  const res = await db.execute(sql`
    SELECT 
      COALESCE(AVG((preview->>'overall')::int), 0) as "avgOverallScore",
      COALESCE(AVG(COALESCE(preview->'categories'->>'speed', preview->'categories'->>'performance')::int), 0) as "avgPerformanceScore",
      COALESCE(AVG(COALESCE(preview->'categories'->>'technical', preview->'categories'->>'seo')::int), 0) as "avgSeoScore",
      COALESCE(AVG((preview->'categories'->>'aeo')::int), 0) as "avgAeoScore",
      COALESCE(AVG((preview->'categories'->>'geo')::int), 0) as "avgGeoScore",
      COALESCE(SUM((preview->>'totalIssuesFound')::int), 0) as "totalIssuesFound"
    FROM scans
  `);

  const stats = res.rows[0] ?? {};
  const avg = (key: string) => Math.round(Number(stats[key] ?? 0));

  return {
    totalUsers: userCountResult?.count || 0,
    totalScans: scanCountResult?.count || 0,
    avgOverallScore: avg("avgOverallScore"),
    avgPerformanceScore: avg("avgPerformanceScore"),
    avgSeoScore: avg("avgSeoScore"),
    avgAeoScore: avg("avgAeoScore"),
    avgGeoScore: avg("avgGeoScore"),
    totalIssuesFound: Number(stats.totalIssuesFound ?? 0),
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
    publicId: scans.publicId,
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

export const getAdminRevenueService = async () => {
  const totals = await db.execute(sql`
    SELECT type, currency,
      COUNT(*)::int AS "count",
      COALESCE(SUM(amount_subunits), 0)::bigint AS "amountSubunits",
      COALESCE(SUM(amount_subunits) FILTER (WHERE created_at >= now() - interval '30 days'), 0)::bigint AS "last30DaysSubunits"
    FROM payments
    WHERE status = 'captured'
    GROUP BY type, currency
    ORDER BY type, currency
  `);

  const scanStats = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE is_unlocked)::int AS "paidScans",
      COUNT(*) FILTER (WHERE is_unlocked AND full_report IS NOT NULL)::int AS "deliveredReports",
      COUNT(*) FILTER (
        WHERE is_unlocked AND full_report IS NULL
          AND (status <> 'generating_full_report'
            OR report_started_at < now() - (${STUCK_REPORT_MINUTES} * interval '1 minute'))
      )::int AS "stuckReports",
      COUNT(*) FILTER (WHERE status = 'report_failed')::int AS "failedReports"
    FROM scans
  `);

  const subs = await db.execute(sql`
    SELECT COUNT(*) FILTER (WHERE status IN ('active', 'cancel_scheduled'))::int AS "activeSubscriptions",
      COUNT(*) FILTER (WHERE status = 'past_due')::int AS "pastDueSubscriptions"
    FROM subscriptions
  `);

  const recentPayments = await db
    .select({
      id: payments.id,
      type: payments.type,
      scanId: payments.scanId,
      userId: payments.userId,
      amountSubunits: payments.amountSubunits,
      currency: payments.currency,
      status: payments.status,
      razorpayPaymentId: payments.razorpayPaymentId,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .orderBy(desc(payments.createdAt))
    .limit(25);

  return {
    totals: totals.rows.map((row: any) => ({
      ...row,
      amountSubunits: Number(row.amountSubunits),
      last30DaysSubunits: Number(row.last30DaysSubunits),
    })),
    scans: scanStats.rows[0] ?? {},
    subscriptions: subs.rows[0] ?? {},
    recentPayments,
  };
};
