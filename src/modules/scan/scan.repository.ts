import { db } from "../../db/db.js";
import { scans } from "../../db/schema/scan.js";
import { and, eq, isNull, lt, ne, or, sql } from "drizzle-orm";

export type ScanRow = typeof scans.$inferSelect;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isPublicScanId = (ref: string) => UUID_PATTERN.test(ref);

export const createScanRepo = async (data: typeof scans.$inferInsert) => {
  const res = await db.insert(scans).values(data).returning();
  return res[0];
};

export const updateScanRepo = async (id: number, data: Partial<typeof scans.$inferInsert>) => {
  await db.update(scans).set(data).where(eq(scans.id, id));
};

export const getScanRepo = async (id: number) => {
  const res = await db.select().from(scans).where(eq(scans.id, id));
  return res[0];
};

export const getScanByPublicIdRepo = async (publicId: string) => {
  const res = await db.select().from(scans).where(eq(scans.publicId, publicId));
  return res[0];
};

export const findScanByRefRepo = async (ref: string | number) => {
  const value = String(ref).trim();
  if (isPublicScanId(value)) return getScanByPublicIdRepo(value);

  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return undefined;
  return getScanRepo(id);
};

export const STUCK_REPORT_MINUTES = 5;

export const claimReportGenerationRepo = async (id: number) => {
  const staleBefore = sql`now() - (${STUCK_REPORT_MINUTES} * interval '1 minute')`;
  const res = await db
    .update(scans)
    .set({ status: "generating_full_report", reportStartedAt: sql`now()` })
    .where(
      and(
        eq(scans.id, id),
        eq(scans.isUnlocked, true),
        isNull(scans.fullReport),
        or(
          isNull(scans.status),
          ne(scans.status, "generating_full_report"),
          isNull(scans.reportStartedAt),
          lt(scans.reportStartedAt, staleBefore),
        ),
      ),
    )
    .returning({ id: scans.id });
  return res.length > 0;
};
