import { sql } from "drizzle-orm";
import { db } from "../db/db.js";
import { logError } from "./errorLog.js";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const consumeRateLimit = async (key: string, max: number, windowMs: number) => {
  const windowSeconds = Math.ceil(windowMs / 1000);
  try {
    const res = await db.execute(sql`
      INSERT INTO rate_limits (key, count, window_start)
      VALUES (${key}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.window_start < now() - (${windowSeconds} * interval '1 second') THEN 1
          ELSE rate_limits.count + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start < now() - (${windowSeconds} * interval '1 second') THEN now()
          ELSE rate_limits.window_start
        END
      RETURNING count
    `);
    const count = Number((res.rows[0] as { count?: number } | undefined)?.count ?? 0);
    return count <= max;
  } catch (err) {
    logError("RATE_LIMIT", err, { key });
    return true;
  }
};

export const checkRateLimit = (ip: string) => consumeRateLimit(`burst:${ip}`, 10, MINUTE);

export const checkOtpRateLimit = (ipOrEmail: string) =>
  consumeRateLimit(`auth:${ipOrEmail.toLowerCase()}`, 5, 10 * MINUTE);

export const checkAiRateLimit = (ipOrUserId: string) =>
  consumeRateLimit(`ai:${ipOrUserId}`, 10, HOUR);

export const checkDailyScanLimit = (key: string, maxScans = 5) =>
  consumeRateLimit(`scan_daily:${key}`, maxScans, DAY);

export const checkGeoRateLimit = (ip: string) => consumeRateLimit(`geo:${ip}`, 20, DAY);

export const pruneRateLimits = async () => {
  await db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '2 days'`);
};
