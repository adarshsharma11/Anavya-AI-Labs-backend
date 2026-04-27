import type { Context } from 'hono';
import * as dashboardService from './dashboard.service';

export const getProfile = async (c: Context) => {
  const user = c.get('user'); // from verifyToken middleware
  try {
    const profile = await dashboardService.getProfileService(user.id);
    return c.json({ success: true, profile });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 404);
  }
};

export const updateProfile = async (c: Context) => {
  const user = c.get('user');
  const body = await c.req.json();
  try {
    const updated = await dashboardService.updateProfileService(user.id, body);
    return c.json({ success: true, profile: updated });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 400);
  }
};

export const getScans = async (c: Context) => {
  const user = c.get('user');
  try {
    const scans = await dashboardService.getUserScansService(user.id);
    return c.json({ success: true, scans });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 400);
  }
};

export const getAnalytics = async (c: Context) => {
  const user = c.get('user');
  try {
    const analytics = await dashboardService.getUserAnalyticsService(user.id);
    return c.json({ success: true, analytics });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 400);
  }
};
