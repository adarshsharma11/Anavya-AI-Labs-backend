import { Hono } from "hono";
import { getSettings, updateSetting } from "../../../modules/settings/settings.controller";

import { verifyToken } from "../../../middlewares/auth.middleware";

const app = new Hono();

// public get
app.get("/", getSettings);

// admin update
app.post("/", verifyToken, updateSetting);

export default app;
