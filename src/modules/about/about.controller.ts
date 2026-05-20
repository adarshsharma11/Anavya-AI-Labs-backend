import type { Context } from "hono";
import { getAboutService, createAboutService } from "./about.service";

export const getAbout = async (c: Context) => {
  try {
    const data = await getAboutService();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || "Failed to fetch about content." }, 500);
  }
};

export const createAbout = async (c: Context) => {
  try {
    const body = await c.req.json();
    const res = await createAboutService(body);
    return c.json({ success: true, data: res });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || "Failed to create about content." }, 500);
  }
};
