import { createScanRepo, updateScanRepo, getScanRepo } from "./scan.repository";
import { runWebsiteScan } from "../../lib/scanner";
import { compareScans } from "../../lib/compareScan";

export const createScanService = async (
  url: string,
  ip: string,
  competitorUrl?: string | null
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
    userId: null,
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
  return scan;
};