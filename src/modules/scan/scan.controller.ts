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

import { generatePdfReport } from "../../lib/pdfGenerator";
import { getProfileService } from "../dashboard/dashboard.service";

export const getScanPdf = async (c: Context) => {
  try {
    const id = Number(c.req.param("id"));
    const scanData = await getScanService(id);
    
    let companyName = "Anavya AI Labs";
    let companyLogoUrl = "";
    
    // Attempt to pull user's saved branding if requested
    const user = c.get("user");
    if (user) {
      try {
        const profile = await getProfileService(user.id);
        if (profile.companyName) companyName = profile.companyName;
        if (profile.companyLogoUrl) companyLogoUrl = profile.companyLogoUrl;
      } catch (e) {}
    }
    
    // Override with query params if provided dynamically
    const qName = c.req.query("companyName");
    const qLogo = c.req.query("companyLogoUrl");
    if (qName) companyName = qName;
    if (qLogo) companyLogoUrl = qLogo;

    const pdfBuffer = await generatePdfReport(scanData, companyName, companyLogoUrl);
    
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="report-${id}.pdf"`);
    
    // Buffer acts as response body
    return new Response(pdfBuffer);
  } catch (e: any) {
    return c.json({ success: false, message: "Failed to generate PDF: " + e.message }, 500);
  }
};
