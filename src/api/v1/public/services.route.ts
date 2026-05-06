import { Hono } from "hono";
import { getServices, createService } from "../../../modules/services/services.controller";

import { verifyToken } from "../../../middlewares/auth.middleware";

const app = new Hono();

// public get
app.get("/services", getServices);

// admin seed/create
app.post("/services", verifyToken, createService);

export default app;
