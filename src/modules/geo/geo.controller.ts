import type { Context } from "hono";
import { desc } from "drizzle-orm";

import { db } from "../../db/db.js";
import { geoChecks } from "../../db/schema/geoChecks.js";
import { AuditError, startSiteAudit } from "../audit/audit.service.js";
import { checkGeoRateLimit } from "../../lib/rateLimiter.js";
import { assertPublicUrl, UnsafeUrlError } from "../../lib/safeUrl.js";
import { getClientIp, normalizeEmail } from "../../lib/request.js";
import { logError } from "../../lib/errorLog.js";

export const runGeoCheck = async (c: Context) => {
  try {
    const body = await c.req.json();
    const url = await assertPublicUrl(body.url);
    const ip = getClientIp(c);
    const user = c.get("user") as { id: number; email: string } | undefined;

    if (!(await checkGeoRateLimit(user ? `user:${user.id}` : ip))) {
      return c.json({ success: false, message: "Daily GEO check limit reached. Try again tomorrow." }, 429);
    }

    const { initial: report } = await startSiteAudit(url, { multiPage: false, speed: false });
    const email = normalizeEmail(body.email) ?? user?.email ?? null;

    try {
      await db.insert(geoChecks).values({
        url,
        email,
        userId: user?.id ?? null,
        userIp: ip,
        score: report.overall,
        result: report,
      });
    } catch (err) {
      logError("GEO_LEAD_SAVE", err, { url });
    }

    return c.json({ success: true, data: report });
  } catch (error: any) {
    if (!(error instanceof UnsafeUrlError) && !(error instanceof AuditError)) logError("GEO_CHECK", error);
    return c.json({
      success: false,
      message: error.message || "Failed to execute GEO analysis."
    }, 400);
  }
};

export const getGeoLeads = async (c: Context) => {
  try {
    const limit = Math.min(Number(c.req.query("limit")) || 100, 500);
    const data = await db
      .select({
        id: geoChecks.id,
        url: geoChecks.url,
        email: geoChecks.email,
        userId: geoChecks.userId,
        score: geoChecks.score,
        createdAt: geoChecks.createdAt,
      })
      .from(geoChecks)
      .orderBy(desc(geoChecks.createdAt))
      .limit(limit);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};
