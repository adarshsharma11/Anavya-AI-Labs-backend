import type { Context } from "hono";
import {
  getServicesService,
  createServiceService,
  updateServiceService,
  deleteServiceService,
} from "./services.service.js";

export const getServices = async (c: Context) => {
  const data = await getServicesService();
  return c.json({ success: true, data });
};

export const createService = async (c: Context) => {
  try {
    const body = await c.req.json();
    const res = await createServiceService(body);
    return c.json({ success: true, data: res });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateService = async (c: Context) => {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const res = await updateServiceService(id, body);
    return c.json({ success: true, data: res });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteService = async (c: Context) => {
  try {
    const id = Number(c.req.param("id"));
    await deleteServiceService(id);
    return c.json({ success: true, message: "Service deleted successfully" });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};
