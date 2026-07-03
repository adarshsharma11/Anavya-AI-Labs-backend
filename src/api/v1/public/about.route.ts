import { Hono } from "hono";
import { getAbout, createAbout } from "../../../modules/about/about.controller";
import { verifyAdminToken } from "../../../middlewares/auth.middleware";

const app = new Hono();

// public get
app.get("/about", getAbout);

// admin create
app.post("/about", verifyAdminToken, createAbout);

export default app;
