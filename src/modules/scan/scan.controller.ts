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
import { AuditError, isAuditComplete } from "../audit/audit.service.js";
import { getCachedPdfRepo, saveCachedPdfRepo } from "./scan.repository.js";

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
      cached: scan.cached,
    });
  } catch (e: any) {
    if (!(e instanceof UnsafeUrlError) && !(e instanceof AuditError)) logError("CREATE_SCAN", e);
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

const supportUrl = () => `${process.env.FRONTEND_URL || "https://anavyaailabs.com"}/support`;

export const getScanPdf = async (c: Context) => {
  try {
    const ref = c.req.param("id") ?? "";
    const { scan, fullAccess } = await findAccessibleScan(ref, c.get("user"));

    if (!isAuditComplete(scan.preview)) {
      return c.json(
        { success: false, code: "REPORT_PENDING", message: "Your audit is still running. Try again in a few seconds." },
        409,
      );
    }

    const includeAiReport = Boolean(scan.isUnlocked && fullAccess);
    if (includeAiReport && !scan.fullReport) {
      return c.json(
        { success: false, code: "REPORT_PENDING", message: "Your AI report is still being generated. Try again in a minute." },
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
    const branded = Boolean(branding.companyName || branding.companyLogoUrl);
    const variant = includeAiReport ? "full" : "audit";

    const cached = branded ? null : await getCachedPdfRepo(scan.id, variant);
    let pdf: Buffer;
    if (cached) {
      pdf = cached;
    } else {
      const { generatePdfReport } = await import("../../lib/pdfGenerator.js");
      pdf = await generatePdfReport(scan, branding, { includeAiReport, supportUrl: supportUrl() });
      if (!branded) await saveCachedPdfRepo(scan.id, variant, pdf).catch((err) => logError("PDF_CACHE", err));
    }

    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="ai-readiness-report-${scan.publicId}.pdf"`);
    return c.body(new Uint8Array(pdf));
  } catch (e: any) {
    if (e instanceof ScanNotFoundError) {
      return c.json({ success: false, message: e.message }, 404);
    }
    logError("SCAN_PDF", e);
    return c.json({ success: false, message: "Failed to generate PDF: " + e.message }, 500);
  }
};
