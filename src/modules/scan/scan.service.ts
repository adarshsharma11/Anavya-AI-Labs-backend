import {
  claimReportGenerationRepo,
  createScanRepo,
  findScanByRefRepo,
  getScanRepo,
  isPublicScanId,
  updateScanRepo,
  type ScanRow,
} from "./scan.repository.js";
import { runWebsiteScan } from "../../lib/scanner.js";
import { compareScans } from "../../lib/compareScan.js";
import { generateFullReport } from "../../lib/aiReport.js";
import { sendReportReadyEmail } from "../../lib/sendOTP.js";
import { runInBackground } from "../../lib/background.js";
import { getUserById } from "../auth/auth.repository.js";
import { lockGeoAnalysis, runGeoAnalysis } from "../geo/geo.service.js";

import { logError } from "../../lib/errorLog.js";

export type ScanViewer = { id?: number; role?: string } | null | undefined;

export class ScanNotFoundError extends Error {
  constructor() {
    super("Scan not found");
  }
}

type CreateScanInput = {
  url: string;
  ip: string;
  competitorUrl?: string | null;
  userId?: number | null;
  email?: string | null;
  autoUnlock?: boolean;
  notify?: boolean;
};

export const createScanService = async (input: CreateScanInput) => {
  const { url, ip, competitorUrl, userId, email, autoUnlock, notify = true } = input;

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
    userEmail: email || null,
    userId: userId || null,
    planId: null,
    isUnlocked: Boolean(autoUnlock),
  });

  if (!scan) {
    logError("CREATE_SCAN", new Error("Scan creation failed"), { url, ip });
    throw new Error("Scan creation failed");
  }

  const [preview, geo, competitorPreview] = await Promise.all([
    runWebsiteScan(url),
    runGeoAnalysis(url).catch((err) => {
      logError("SCAN_GEO", err, { url });
      return null;
    }),
    competitorUrl
      ? runWebsiteScan(competitorUrl).catch((err) => {
          logError("COMPETITOR_SCAN", err, { competitorUrl });
          return null;
        })
      : Promise.resolve(null),
  ]);

  const fullPreview = { ...preview, geo };
  const competitorAnalysis =
    competitorPreview ? compareScans(fullPreview, competitorPreview) : null;

  await updateScanRepo(scan.id, {
    status: autoUnlock ? "paid" : "preview_done",
    preview: fullPreview,
    competitorPreview,
    competitorAnalysis,
  });

  if (autoUnlock) {
    runInBackground("PRO_REPORT_GENERATION", generateAndStoreReport(scan.id, { notify }));
  }

  return { id: scan.id, publicId: scan.publicId, score: preview.overall };
};

export const resolveReportEmail = async (scan: ScanRow) => {
  if (scan.userEmail) return scan.userEmail;
  if (!scan.userId) return null;
  const user = await getUserById(scan.userId);
  return user?.email ?? null;
};

export const generateAndStoreReport = async (scanId: number, options: { notify?: boolean } = {}) => {
  const claimed = await claimReportGenerationRepo(scanId);
  if (!claimed) return;

  const scan = await getScanRepo(scanId);
  if (!scan?.preview) {
    await updateScanRepo(scanId, { status: "report_failed" });
    return;
  }

  try {
    const fullReport = await generateFullReport(scan.url, scan.preview, {
      url: scan.competitorUrl,
      preview: scan.competitorPreview,
      analysis: scan.competitorAnalysis,
    });
    await updateScanRepo(scanId, { fullReport, status: "completed" });

    const email = options.notify === false ? null : await resolveReportEmail(scan);
    if (email) await sendReportReadyEmail(email, scan.publicId, scan.url);
  } catch (err) {
    logError("AI_REPORT_GENERATION_SERVICE", err, { scanId });
    await updateScanRepo(scanId, { status: "report_failed" });
  }
};

const lockPreview = (preview: any) => {
  if (!preview) return preview;
  const { allIssues, allQuickWins, geo, ...rest } = preview;
  return { ...rest, geo: lockGeoAnalysis(geo), locked: true };
};

const unlockPreview = (preview: any) => (preview ? { ...preview, locked: false } : preview);

export const canAccessFullReport = (scan: ScanRow, ref: string, viewer: ScanViewer) => {
  if (viewer?.role === "admin") return true;
  if (viewer?.id && scan.userId === viewer.id) return true;
  return isPublicScanId(ref) && ref.toLowerCase() === scan.publicId.toLowerCase();
};

export const findAccessibleScan = async (ref: string, viewer: ScanViewer) => {
  const scan = await findScanByRefRepo(ref);
  if (!scan) throw new ScanNotFoundError();

  const fullAccess = canAccessFullReport(scan, ref, viewer);
  if (!isPublicScanId(ref) && !fullAccess) throw new ScanNotFoundError();

  return { scan, fullAccess };
};

export const getScanService = async (ref: string, viewer: ScanViewer) => {
  const { scan, fullAccess } = await findAccessibleScan(ref, viewer);
  const unlocked = Boolean(scan.isUnlocked) && fullAccess;

  if (scan.isUnlocked && !scan.fullReport && scan.preview) {
    runInBackground("REPORT_RETRY", generateAndStoreReport(scan.id));
  }

  return {
    id: scan.id,
    publicId: scan.publicId,
    url: scan.url,
    competitorUrl: scan.competitorUrl,
    status: scan.status,
    preview: unlocked ? unlockPreview(scan.preview) : lockPreview(scan.preview),
    competitorPreview: unlocked
      ? unlockPreview(scan.competitorPreview)
      : lockPreview(scan.competitorPreview),
    competitorAnalysis: scan.competitorAnalysis,
    fullReport: unlocked ? scan.fullReport : null,
    isUnlocked: Boolean(scan.isUnlocked),
    locked: !unlocked,
    processing: unlocked && !scan.fullReport,
    createdAt: scan.createdAt,
  };
};
