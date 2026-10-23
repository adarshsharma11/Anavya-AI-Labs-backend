import { Hono, type Context, type Next } from "hono";
import crypto from "crypto";
import { getCronSecret } from "../lib/secrets.js";
import { generateDailyBlogs } from "../services/blogGenerator.js";
import { runDueMonitors } from "../modules/monitor/monitor.service.js";
import { pruneRateLimits } from "../lib/rateLimiter.js";
import { logError } from "../lib/errorLog.js";

const cronRoute = new Hono();

const verifyCron = async (c: Context, next: Next) => {
  let expected: string;
  try {
    expected = `Bearer ${getCronSecret()}`;
  } catch {
    return c.json({ success: false, message: "CRON_SECRET is not configured" }, 500);
  }

  const actual = c.req.header("Authorization") ?? "";
  const valid =
    actual.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  if (!valid) return c.json({ success: false, message: "Unauthorized" }, 401);

  await next();
};

cronRoute.use("*", verifyCron);

cronRoute.get("/blogs", async (c) => {
  try {
    const blogs = await generateDailyBlogs();
    return c.json({ success: true, drafts: blogs.length });
  } catch (err: any) {
    logError("CRON_BLOGS", err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

cronRoute.get("/monitors", async (c) => {
  try {
    const results = await runDueMonitors();
    await pruneRateLimits().catch((err) => logError("CRON_PRUNE_RATE_LIMITS", err));
    return c.json({ success: true, checked: results.length, results });
  } catch (err: any) {
    logError("CRON_MONITORS", err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

export default cronRoute;
