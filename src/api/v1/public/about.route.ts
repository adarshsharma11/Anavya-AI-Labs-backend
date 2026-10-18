import { Hono } from "hono";
import { getAbout, createAbout } from "../../../modules/about/about.controller.js";
import { verifyAdminToken } from "../../../middlewares/auth.middleware.js";

const app = new Hono();

// public get
app.get("/about", getAbout);

// admin create
app.post("/about", verifyAdminToken, createAbout);

export default app;
