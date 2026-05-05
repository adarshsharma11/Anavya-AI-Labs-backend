import { createScanRepo, updateScanRepo, getScanRepo } from "./scan.repository";
import { runWebsiteScan } from "../../lib/scanner";
import { compareScans } from "../../lib/compareScan";
import { generateFullReport } from "../../lib/aiReport";
import { sendReportReadyEmail } from "../../lib/sendOTP";
import { getUserById } from "../auth/auth.repository";

import { logError } from "../../lib/errorLog";

export const createScanService = async (
  url: string,
  ip: string,
  competitorUrl?: string | null,
  userId?: number | null
) => {
  // =====================
  // CREATE DB ENTRY
  // =====================
  const scan = await createScanRepo({
    url,
    competitorUrl: competitorUrl || null,
    normalizedUrl: url.toLowerCase(),
    userIp: ip,
    status: "processing",

    preview: null,
    competitorPreview: null,
    competitorAnalysis: null,
    fullReport: null,

    userEmail: null,
    userId: userId || null,
    planId: null,
    isUnlocked: false,
  });

  if (!scan) {
    logError("CREATE_SCAN", new Error("Scan creation failed"), { url, ip });
    throw new Error("Scan creation failed");
  }

  // =====================
  // MAIN SITE SCAN
  // =====================
  const preview = await runWebsiteScan(url);

  // =====================
  // COMPETITOR SCAN
  // =====================
  let competitorPreview: any = null;

  if (competitorUrl) {
    try {
      competitorPreview = await runWebsiteScan(competitorUrl);
    } catch (err) {
      logError("COMPETITOR_SCAN", err, { competitorUrl });
      competitorPreview = null;
    }
  }

  // =====================
  // COMPARE BOTH
  // =====================
  let competitorAnalysis = null;

  if (preview && competitorPreview) {
    competitorAnalysis = compareScans(preview, competitorPreview);
  }

  // =====================
  // UPDATE DB
  // =====================
  await updateScanRepo(scan.id, {
    status: "preview_done",
    preview,
    competitorPreview,
    competitorAnalysis,
  });

  return scan.id;
};

export const getScanService = async (id: number) => {
  const scan = await getScanRepo(id);
  if (!scan) throw new Error("Scan not found");

  // =====================
  // SYNC PREVIEW LOCK STATE
  // =====================
  if (scan.preview) {
    scan.preview.locked = !scan.isUnlocked;
  }

  if (scan.competitorPreview) {
    scan.competitorPreview.locked = !scan.isUnlocked;
  }

  // =====================
  // FREE RESPONSE
  // =====================
  if (!scan.isUnlocked) {
    return {
      id: scan.id,
      url: scan.url,
      preview: scan.preview,
      competitorPreview: scan.competitorPreview,
      competitorAnalysis: scan.competitorAnalysis,
      locked: true,
    };
  }

  // =====================
  // PAID FULL REPORT
  // =====================
  if (scan.isUnlocked && !scan.fullReport) {
    if (scan.preview && scan.status !== "generating_full_report") {
      void (async () => {
        await updateScanRepo(scan.id, { status: "generating_full_report" });
        try {
          const fullReport = await generateFullReport(scan.url, scan.preview, {
            url: scan.competitorUrl,
            preview: scan.competitorPreview,
            analysis: scan.competitorAnalysis,
          });
          await updateScanRepo(scan.id, { fullReport, status: "completed" });

          // Send email notification
          let targetEmail = scan.userEmail;
          if (!targetEmail && scan.userId) {
            const user = await getUserById(scan.userId);
            if (user) targetEmail = user.email;
          }

          if (targetEmail) {
            await sendReportReadyEmail(targetEmail, scan.id, scan.url);
          }
        } catch (err: any) {
          logError("AI_REPORT_GENERATION_SERVICE", err, { scanId: scan.id });
          await updateScanRepo(scan.id, { status: "completed" });
        }
      })();
    }

    return {
      id: scan.id,
      url: scan.url,
      preview: scan.preview,
      competitorPreview: scan.competitorPreview,
      competitorAnalysis: scan.competitorAnalysis,
      locked: false,
      processing: true,
      status: scan.status,
    };
  }

  return scan;
};
