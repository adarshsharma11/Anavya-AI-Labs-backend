import type { Context } from "hono";
import {
  getServicesService,
  createServiceService,
  createPageService,
} from "./services.service";

export const getServices = async (c: Context) => {
  const data = await getServicesService();
  return c.json({ success: true, data });
};

export const createService = async (c: Context) => {
  const body = await c.req.json();
  const res = await createServiceService(body);
  return c.json({ success: true, data: res });
};

export const createPage = async (c: Context) => {
  const body = await c.req.json();
  const res = await createPageService(body);
  return c.json({ success: true, data: res });
};
