import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../../db/db.js";
import { monitors } from "../../db/schema/monitors.js";
import { scans } from "../../db/schema/scan.js";
import { assertPublicUrl } from "../../lib/safeUrl.js";
import { runInBackground } from "../../lib/background.js";
import { sendScoreDropEmail } from "../../lib/sendOTP.js";
import { logError } from "../../lib/errorLog.js";
import { createScanService } from "../scan/scan.service.js";
import { getUserPlanLimits } from "../subscription/subscription.service.js";
import { getUserById } from "../auth/auth.repository.js";

export const MAX_MONITORS_PER_USER = 10;
export const MONITOR_INTERVAL_DAYS = 7;
export const SCORE_DROP_ALERT = 5;

type Monitor = typeof monitors.$inferSelect;

export class MonitorError extends Error {
  constructor(message: string, public status: 400 | 402 | 404 = 400) {
    super(message);
  }
}

export const listMonitorsService = async (userId: number) => {
  return db.select().from(monitors).where(eq(monitors.userId, userId)).orderBy(desc(monitors.createdAt));
};

export const addMonitorService = async (userId: number, rawUrl: unknown) => {
  const { monitoring } = await getUserPlanLimits(userId);
  if (!monitoring) throw new MonitorError("Weekly monitoring is included in the Pro plan. Upgrade to add monitors.", 402);

  const url = await assertPublicUrl(rawUrl);
  const existing = await listMonitorsService(userId);
  if (existing.some((m) => m.url === url)) throw new MonitorError("This URL is already monitored");
  if (existing.length >= MAX_MONITORS_PER_USER) {
    throw new MonitorError(`You can monitor up to ${MAX_MONITORS_PER_USER} URLs`);
  }

  const [monitor] = await db.insert(monitors).values({ userId, url }).returning();
  if (!monitor) throw new MonitorError("Could not create monitor");

  runInBackground("MONITOR_INITIAL_SCAN", checkMonitor(monitor));
  return monitor;
};

export const deleteMonitorService = async (userId: number, id: number) => {
  const [deleted] = await db
    .delete(monitors)
    .where(and(eq(monitors.id, id), eq(monitors.userId, userId)))
    .returning();
  if (!deleted) throw new MonitorError("Monitor not found", 404);
  return deleted;
};

export const getMonitorHistoryService = async (userId: number, id: number) => {
  const [monitor] = await db
    .select()
    .from(monitors)
    .where(and(eq(monitors.id, id), eq(monitors.userId, userId)));
  if (!monitor) throw new MonitorError("Monitor not found", 404);

  const history = await db
    .select({
      publicId: scans.publicId,
      status: scans.status,
      overall: sql<number | null>`(${scans.preview}->>'overall')::int`,
      geoScore: sql<number | null>`COALESCE(${scans.preview}->'categories'->>'geo', ${scans.preview}->'geo'->'score'->>'value')::int`,
      aeoScore: sql<number | null>`(${scans.preview}->'categories'->>'aeo')::int`,
      createdAt: scans.createdAt,
    })
    .from(scans)
    .where(and(eq(scans.userId, userId), eq(scans.normalizedUrl, monitor.url.toLowerCase())))
    .orderBy(desc(scans.createdAt))
    .limit(30);

  return { monitor, history };
};

export const checkMonitor = async (monitor: Monitor) => {
  const { monitoring } = await getUserPlanLimits(monitor.userId);
  if (!monitoring) {
    await db.update(monitors).set({ lastCheckedAt: new Date() }).where(eq(monitors.id, monitor.id));
    return { id: monitor.id, skipped: "plan_excludes_monitoring" as const };
  }

  const scan = await createScanService({
    url: monitor.url,
    ip: "monitor",
    userId: monitor.userId,
    autoUnlock: true,
    notify: false,
    useCache: false,
    waitForCompletion: true,
  });

  await db
    .update(monitors)
    .set({ lastScanId: scan.id, lastScore: scan.score, lastCheckedAt: new Date() })
    .where(eq(monitors.id, monitor.id));

  const previous = monitor.lastScore;
  const dropped = previous !== null && previous - scan.score >= SCORE_DROP_ALERT;
  if (dropped) {
    const user = await getUserById(monitor.userId);
    if (user?.email) {
      await sendScoreDropEmail(user.email, monitor.url, previous, scan.score, scan.publicId);
    }
  }

  return { id: monitor.id, score: scan.score, previous, alerted: dropped };
};

export const runDueMonitors = async (limit = 5) => {
  const due = await db
    .select()
    .from(monitors)
    .where(
      or(
        isNull(monitors.lastCheckedAt),
        lt(monitors.lastCheckedAt, sql`now() - (${MONITOR_INTERVAL_DAYS} * interval '1 day')`),
      ),
    )
    .orderBy(sql`${monitors.lastCheckedAt} ASC NULLS FIRST`)
    .limit(limit);

  const results = await Promise.allSettled(due.map((monitor) => checkMonitor(monitor)));
  return results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    logError("MONITOR_CHECK", result.reason, { monitorId: due[i]?.id });
    return { id: due[i]?.id, error: String(result.reason?.message || result.reason) };
  });
};
