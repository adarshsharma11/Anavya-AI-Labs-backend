import type { Context } from "hono";
import {
  createScanService,
  findAccessibleScan,
  getScanService,
  ScanNotFoundError,
} from "./scan.service.js";
import { checkRateLimit, checkDailyScanLimit } from "../../lib/rateLimiter.js";
import { assertPublicUrl, UnsafeUrlError } from "../../lib/safeUrl.js";
import { getClientIp, normalizeEmail } from "../../lib/request.js";
import { getUserPlanLimits } from "../subscription/subscription.service.js";
import { getProfileService } from "../dashboard/dashboard.service.js";
import { logError } from "../../lib/errorLog.js";

export const createScan = async (c: Context) => {
  try {
    const body = await c.req.json();
    const ip = getClientIp(c);
    const user = c.get("user") as { id: number; email: string } | undefined;

    const url = await assertPublicUrl(body.url);
    const competitorUrl = body.competitorUrl ? await assertPublicUrl(body.competitorUrl) : null;

    if (!(await checkRateLimit(`scan:${ip}`))) {
      return c.json({ success: false, message: "Too many requests. Please wait a minute." }, 429);
    }

    const limits = await getUserPlanLimits(user?.id);
    if (limits.dailyScanLimit !== null) {
      const limitKey = user ? `user:${user.id}` : `ip:${ip}`;
      if (!(await checkDailyScanLimit(limitKey, limits.dailyScanLimit))) {
        return c.json(
          {
            success: false,
            code: "DAILY_LIMIT",
            message: `Free plan limit reached: ${limits.dailyScanLimit} scans per day. Upgrade to Pro for unlimited scans.`,
          },
          429,
        );
      }
    }

    const scan = await createScanService({
      url,
      ip,
      competitorUrl,
      userId: user?.id,
      email: normalizeEmail(body.email) ?? user?.email ?? null,
      autoUnlock: limits.isPro,
    });

    return c.json({
      success: true,
      scanId: scan.publicId,
      publicId: scan.publicId,
      unlocked: limits.isPro,
    });
  } catch (e: any) {
    if (!(e instanceof UnsafeUrlError)) logError("CREATE_SCAN", e);
    return c.json({ success: false, message: e.message }, 400);
  }
};

export const getScan = async (c: Context) => {
  try {
    const data = await getScanService(c.req.param("id") ?? "", c.get("user"));
    return c.json({ success: true, data });
  } catch (e: any) {
    const status = e instanceof ScanNotFoundError ? 404 : 500;
    return c.json({ success: false, message: e.message }, status);
  }
};

export const getScanPdf = async (c: Context) => {
  try {
    const ref = c.req.param("id") ?? "";
    const { scan, fullAccess } = await findAccessibleScan(ref, c.get("user"));

    if (!scan.isUnlocked || !fullAccess) {
      return c.json(
        { success: false, code: "PAYMENT_REQUIRED", message: "Unlock the full report to download the PDF." },
        402,
      );
    }
    if (!scan.fullReport) {
      return c.json(
        { success: false, code: "REPORT_PENDING", message: "Your report is still being generated. Try again in a minute." },
        409,
      );
    }

    const branding: { companyName?: string; companyLogoUrl?: string } = {};
    const user = c.get("user") as { id: number } | undefined;
    if (user && (await getUserPlanLimits(user.id)).isPro) {
      const profile = await getProfileService(user.id).catch(() => null);
      branding.companyName = c.req.query("companyName") || profile?.companyName || undefined;
      branding.companyLogoUrl = c.req.query("companyLogoUrl") || profile?.companyLogoUrl || undefined;
    }

    const { generatePdfReport } = await import("../../lib/pdfGenerator.js");
    const pdfBuffer = await generatePdfReport(scan, branding);

    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="report-${scan.publicId}.pdf"`);
    return c.body(new Uint8Array(pdfBuffer));
  } catch (e: any) {
    if (e instanceof ScanNotFoundError) {
      return c.json({ success: false, message: e.message }, 404);
    }
    logError("SCAN_PDF", e);
    return c.json({ success: false, message: "Failed to generate PDF: " + e.message }, 500);
  }
};
