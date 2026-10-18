import { Hono } from "hono";
import {
  getAdminAnalytics,
  getAdminUsers,
  deleteAdminUser,
  getAdminScans,
} from "../../modules/admin/admin.controller.js";
import { verifyAdminToken } from "../../middlewares/auth.middleware.js";

const adminRoute = new Hono();

// Apply verifyAdminToken to all administrative endpoints
adminRoute.use("/admin/*", verifyAdminToken);

adminRoute.get("/admin/analytics", getAdminAnalytics);
adminRoute.get("/admin/users", getAdminUsers);
adminRoute.delete("/admin/users/:id", deleteAdminUser);
adminRoute.get("/admin/scans", getAdminScans);

export default adminRoute;
