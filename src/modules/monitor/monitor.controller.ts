import type { Context } from "hono";
import {
  addMonitorService,
  deleteMonitorService,
  getMonitorHistoryService,
  listMonitorsService,
  MonitorError,
} from "./monitor.service.js";

const userId = (c: Context) => (c.get("user") as { id: number }).id;

const fail = (c: Context, err: any) =>
  c.json({ success: false, message: err.message }, err instanceof MonitorError ? err.status : 400);

export const listMonitors = async (c: Context) => {
  try {
    return c.json({ success: true, data: await listMonitorsService(userId(c)) });
  } catch (err) {
    return fail(c, err);
  }
};

export const addMonitor = async (c: Context) => {
  try {
    const body = await c.req.json();
    return c.json({ success: true, data: await addMonitorService(userId(c), body.url) });
  } catch (err) {
    return fail(c, err);
  }
};

export const deleteMonitor = async (c: Context) => {
  try {
    await deleteMonitorService(userId(c), Number(c.req.param("id")));
    return c.json({ success: true });
  } catch (err) {
    return fail(c, err);
  }
};

export const getMonitorHistory = async (c: Context) => {
  try {
    const data = await getMonitorHistoryService(userId(c), Number(c.req.param("id")));
    return c.json({ success: true, data });
  } catch (err) {
    return fail(c, err);
  }
};
