import type { Context } from "hono";
import { getSiteSettingsService, updateSettingService } from "./settings.service";

export const getSettings = async (c: Context) => {
  try {
    const settings = await getSiteSettingsService();
    return c.json({ success: true, data: settings });
  } catch (error: any) {
    c.status(500);
    return c.json({ success: false, message: error.message });
  }
};

export const updateSetting = async (c: Context) => {
  try {
    const body = await c.req.json();
    if (!body.key || !body.value) {
      c.status(400);
      return c.json({ success: false, message: "Key and value are required" });
    }
    const updated = await updateSettingService(body.key, body.value);
    return c.json({ success: true, data: updated });
  } catch (error: any) {
    c.status(500);
    return c.json({ success: false, message: error.message });
  }
};
