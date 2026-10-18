import { Hono } from "hono";
import { getServices, createService, updateService, deleteService } from "../../../modules/services/services.controller.js";
import { verifyAdminToken } from "../../../middlewares/auth.middleware.js";

const app = new Hono();

// public get
app.get("/services", getServices);

// admin CRUD operations
app.post("/services", verifyAdminToken, createService);
app.put("/services/:id", verifyAdminToken, updateService);
app.delete("/services/:id", verifyAdminToken, deleteService);

export default app;
