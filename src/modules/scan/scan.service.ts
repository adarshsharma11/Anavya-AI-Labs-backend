import { createScanRepo, updateScanRepo, getScanRepo } from "./scan.repository";
import { runWebsiteScan } from "../../lib/scanner";
import { compareScans } from "../../lib/compareScan";
import { generateFullReport } from "../../lib/aiReport";

const buildFailureReport = (message: string) => {
  return {
    executiveSummary: "Report generation failed",
    technicalAnalysis: "",
    seoImprovements: [],
    performanceImprovements: [],
    businessGrowthSuggestions: [],
    estimatedTrafficImpact: "",
    error: message,
  };
};

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

  if (!scan) throw new Error("Scan creation failed");

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
    } catch {
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
        } catch (err: any) {
          await updateScanRepo(scan.id, {
            fullReport: buildFailureReport(err?.message || "Unknown error"),
            status: "completed",
          });
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
