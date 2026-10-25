import {
  claimReportGenerationRepo,
  createScanRepo,
  findRecentCompleteScanRepo,
  findScanByRefRepo,
  getScanRepo,
  isPublicScanId,
  updateScanRepo,
  type ScanRow,
} from "./scan.repository.js";
import { generateFullReport } from "../../lib/aiReport.js";
import { sendReportReadyEmail } from "../../lib/sendOTP.js";
import { runInBackground } from "../../lib/background.js";
import { getUserById } from "../auth/auth.repository.js";
import { isAuditComplete, startSiteAudit, summarizeAuditForAi } from "../audit/audit.service.js";
import { compareAudits } from "../audit/compare.js";
import type { AuditReport } from "../audit/types.js";

import { logError } from "../../lib/errorLog.js";

export type ScanViewer = { id?: number; role?: string } | null | undefined;

export class ScanNotFoundError extends Error {
  constructor() {
    super("Scan not found");
  }
}

export const AUDIT_CACHE_HOURS = 24;

type CreateScanInput = {
  url: string;
  ip: string;
  competitorUrl?: string | null;
  userId?: number | null;
  email?: string | null;
  autoUnlock?: boolean;
  notify?: boolean;
  useCache?: boolean;
  waitForCompletion?: boolean;
};

const isV2 = (preview: unknown): preview is AuditReport =>
  Boolean(preview && typeof preview === "object" && (preview as { version?: number }).version === 2);

const settledStatus = (scan: ScanRow) =>
  scan.fullReport ? "completed" : scan.isUnlocked ? "paid" : "preview_done";

const finishScan = async (scanId: number, notify: boolean) => {
  const scan = await getScanRepo(scanId);
  if (!scan) return;
  await updateScanRepo(scanId, { status: settledStatus(scan) });
  if (scan.isUnlocked && !scan.fullReport) await generateAndStoreReport(scanId, { notify });
};

export const createScanService = async (input: CreateScanInput) => {
  const {
    url,
    ip,
    competitorUrl,
    userId,
    email,
    autoUnlock = false,
    notify = true,
    useCache = true,
    waitForCompletion = false,
  } = input;
  const normalizedUrl = url.toLowerCase();
  const baseRow = {
    url,
    competitorUrl: competitorUrl || null,
    normalizedUrl,
    userIp: ip,
    fullReport: null,
    userEmail: email || null,
    userId: userId || null,
    planId: null,
    isUnlocked: autoUnlock,
  };

  const cached = useCache && !competitorUrl ? await findRecentCompleteScanRepo(normalizedUrl, AUDIT_CACHE_HOURS) : undefined;
  if (cached?.preview) {
    const scan = await createScanRepo({ ...baseRow, status: autoUnlock ? "paid" : "preview_done", preview: cached.preview });
    if (!scan) throw new Error("Scan creation failed");
    if (autoUnlock) runInBackground("PRO_REPORT_GENERATION", generateAndStoreReport(scan.id, { notify }));
    return { id: scan.id, publicId: scan.publicId, score: cached.preview.overall as number, cached: true };
  }

  let resolveRow: (id: number) => void = () => {};
  const rowReady = new Promise<number>((resolve) => {
    resolveRow = resolve;
  });

  const competitorAudit = competitorUrl
    ? startSiteAudit(competitorUrl, { multiPage: true, speed: false }).catch((err) => {
        logError("COMPETITOR_SCAN", err, { competitorUrl });
        return null;
      })
    : Promise.resolve(null);

  const run = await startSiteAudit(url, { multiPage: true, speed: true }, async (report) => {
    await updateScanRepo(await rowReady, { preview: report });
  });
  const competitorRun = await competitorAudit;
  const competitorPreview = competitorRun?.initial ?? null;

  const scan = await createScanRepo({
    ...baseRow,
    status: "processing",
    preview: run.initial,
    competitorPreview,
    competitorAnalysis: competitorPreview ? compareAudits(run.initial, competitorPreview) : null,
  });
  if (!scan) {
    logError("CREATE_SCAN", new Error("Scan creation failed"), { url, ip });
    throw new Error("Scan creation failed");
  }
  resolveRow(scan.id);

  const finish = Promise.all([run.completion, competitorRun?.completion ?? null]).then(async ([final, competitorFinal]) => {
    await updateScanRepo(scan.id, {
      preview: final,
      ...(competitorFinal
        ? { competitorPreview: competitorFinal, competitorAnalysis: compareAudits(final, competitorFinal) }
        : {}),
    });
    await finishScan(scan.id, notify);
    return final;
  });

  if (waitForCompletion) {
    const final = await finish;
    return { id: scan.id, publicId: scan.publicId, score: final.overall, cached: false };
  }

  runInBackground("AUDIT_COMPLETION", finish);
  return { id: scan.id, publicId: scan.publicId, score: run.initial.overall, cached: false };
};

export const resolveReportEmail = async (scan: ScanRow) => {
  if (scan.userEmail) return scan.userEmail;
  if (!scan.userId) return null;
  const user = await getUserById(scan.userId);
  return user?.email ?? null;
};

const aiInput = (preview: unknown) => (isV2(preview) ? summarizeAuditForAi(preview) : preview);

export const generateAndStoreReport = async (scanId: number, options: { notify?: boolean } = {}) => {
  const current = await getScanRepo(scanId);
  if (!current?.preview || !isAuditComplete(current.preview)) return;

  const claimed = await claimReportGenerationRepo(scanId);
  if (!claimed) return;

  const scan = (await getScanRepo(scanId)) ?? current;
  try {
    const fullReport = await generateFullReport(scan.url, aiInput(scan.preview), {
      url: scan.competitorUrl,
      preview: aiInput(scan.competitorPreview),
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

const lockLegacyPreview = (preview: any) => {
  if (!preview || isV2(preview)) return preview;
  const { allIssues, allQuickWins, ...rest } = preview;
  return { ...rest, locked: true };
};

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
  const auditComplete = isAuditComplete(scan.preview) && scan.status !== "processing";

  if (scan.isUnlocked && !scan.fullReport && auditComplete) {
    runInBackground("REPORT_RETRY", generateAndStoreReport(scan.id));
  }

  return {
    id: scan.id,
    publicId: scan.publicId,
    url: scan.url,
    competitorUrl: scan.competitorUrl,
    status: scan.status,
    reportVersion: isV2(scan.preview) ? 2 : 1,
    auditComplete,
    preview: unlocked ? scan.preview : lockLegacyPreview(scan.preview),
    competitorPreview: scan.competitorPreview,
    competitorAnalysis: scan.competitorAnalysis,
    competitorStatus: !scan.competitorUrl
      ? null
      : scan.competitorPreview
        ? auditComplete ? "done" : "running"
        : "failed",
    fullReport: unlocked ? scan.fullReport : null,
    isUnlocked: Boolean(scan.isUnlocked),
    locked: !unlocked,
    processing: unlocked && !scan.fullReport,
    createdAt: scan.createdAt,
  };
};
