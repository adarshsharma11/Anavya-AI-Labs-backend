import { Hono } from "hono";
import {
  getAdminAnalytics,
  getAdminUsers,
  deleteAdminUser,
  getAdminScans,
  getAdminRevenue,
  regenerateScanReport,
} from "../../modules/admin/admin.controller.js";
import { getAdminBlogs } from "../../modules/blogs/blogs.controller.js";
import { getGeoLeads } from "../../modules/geo/geo.controller.js";
import { deleteReview, getAdminReviews, updateReviewStatus } from "../../modules/reviews/reviews.controller.js";
import { verifyAdminToken } from "../../middlewares/auth.middleware.js";

const adminRoute = new Hono();

// Apply verifyAdminToken to all administrative endpoints
adminRoute.use("/admin/*", verifyAdminToken);

adminRoute.get("/admin/analytics", getAdminAnalytics);
adminRoute.get("/admin/revenue", getAdminRevenue);
adminRoute.get("/admin/users", getAdminUsers);
adminRoute.delete("/admin/users/:id", deleteAdminUser);
adminRoute.get("/admin/scans", getAdminScans);
adminRoute.post("/admin/scans/:id/regenerate", regenerateScanReport);
adminRoute.get("/admin/geo-leads", getGeoLeads);
adminRoute.get("/admin/blogs", getAdminBlogs);
adminRoute.get("/admin/reviews", getAdminReviews);
adminRoute.patch("/admin/reviews/:id", updateReviewStatus);
adminRoute.delete("/admin/reviews/:id", deleteReview);

export default adminRoute;
