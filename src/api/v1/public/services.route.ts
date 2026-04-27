import { Hono } from "hono";
import { getServices, createService } from "../../../modules/services/services.controller";

const app = new Hono();

// public get
app.get("/services", getServices);

// admin seed/create
app.post("/services", createService);

export default app;
