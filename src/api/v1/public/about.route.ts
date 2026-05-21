import { Hono } from "hono";
import { getAbout, createAbout } from "../../../modules/about/about.controller";
import { verifyToken } from "../../../middlewares/auth.middleware";

const app = new Hono();

// public get
app.get("/about", getAbout);

// admin create
app.post("/about", verifyToken, createAbout);

export default app;
