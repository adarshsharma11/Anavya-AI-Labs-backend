import type { Context } from "hono";
import {
  getAdminAnalyticsService,
  getAdminUsersService,
  deleteUserService,
  getAdminScansService,
  getAdminRevenueService,
} from "./admin.service.js";
import { clearCachedPdfsRepo, getScanRepo, updateScanRepo } from "../scan/scan.repository.js";
import { generateAndStoreReport } from "../scan/scan.service.js";
import { aiReportsEnabled } from "../../lib/features.js";

export const getAdminAnalytics = async (c: Context) => {
  try {
    const data = await getAdminAnalyticsService();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const getAdminUsers = async (c: Context) => {
  try {
    const data = await getAdminUsersService();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const deleteAdminUser = async (c: Context) => {
  try {
    const id = Number(c.req.param("id"));
    await deleteUserService(id);
    return c.json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getAdminScans = async (c: Context) => {
  try {
    const data = await getAdminScansService();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const getAdminRevenue = async (c: Context) => {
  try {
    const data = await getAdminRevenueService();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const regenerateScanReport = async (c: Context) => {
  if (!aiReportsEnabled()) {
    return c.json({ success: false, code: "FEATURE_DISABLED", message: "AI reports are turned off (AI_REPORTS_ENABLED)." }, 410);
  }
  try {
    const scan = await getScanRepo(Number(c.req.param("id")));
    if (!scan) return c.json({ success: false, message: "Scan not found" }, 404);
    if (!scan.isUnlocked) return c.json({ success: false, message: "Scan is not paid" }, 400);

    await updateScanRepo(scan.id, { fullReport: null, status: "paid", reportStartedAt: null });
    await clearCachedPdfsRepo(scan.id);
    await generateAndStoreReport(scan.id);

    const updated = await getScanRepo(scan.id);
    return c.json({ success: true, data: { id: scan.id, status: updated?.status } });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};
