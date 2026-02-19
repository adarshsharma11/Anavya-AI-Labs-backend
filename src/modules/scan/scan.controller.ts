import type { Context } from "hono";
import { createScanService, getScanService } from "./scan.service";
import { checkRateLimit } from "../../lib/rateLimiter";

export const createScan = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { url, competitorUrl } = body;

    if (!url) throw new Error("URL required");

    const ip =
      c.req.header("x-forwarded-for") ||
      "local";

    if (!checkRateLimit(ip)) {
      return c.json({
        success: false,
        message: "Too many scans. Try later",
      }, 429);
    }

    const scanId = await createScanService(url, ip, competitorUrl);

    return c.json({
      success: true,
      scanId,
    });
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 400);
  }
};

export const getScan = async (c: Context) => {
  try {
    const id = Number(c.req.param("id"));
    const data = await getScanService(id);

    return c.json({ success: true, data });
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 404);
  }
};
