import { Hono } from "hono";
import { getSettings, updateSetting } from "../../../modules/settings/settings.controller.js";

import { verifyAdminToken } from "../../../middlewares/auth.middleware.js";

const app = new Hono();

// public get
app.get("/settings", getSettings);

// admin update
app.post("/settings", verifyAdminToken, updateSetting);

export default app;
