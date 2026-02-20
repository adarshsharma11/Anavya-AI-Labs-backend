import { Hono } from "hono";
import { getServices, createService, createPage } from "../../../modules/services/services.controller";

const app = new Hono();

// public get
app.get("/services", getServices);

// admin seed/create
app.post("/services", createService);
app.post("/services/page", createPage);

export default app;
