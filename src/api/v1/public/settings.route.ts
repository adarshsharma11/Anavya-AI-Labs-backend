import { Hono } from "hono";
import { getSettings, updateSetting } from "../../../modules/settings/settings.controller";

const app = new Hono();

// public get
app.get("/", getSettings);

// admin update
app.post("/", updateSetting);

export default app;
