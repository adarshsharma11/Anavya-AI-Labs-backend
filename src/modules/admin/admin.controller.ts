import type { Context } from "hono";
import {
  getAdminAnalyticsService,
  getAdminUsersService,
  deleteUserService,
  getAdminScansService,
} from "./admin.service.js";

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
