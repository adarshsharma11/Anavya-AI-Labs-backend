import { Hono } from "hono";
import { createScan, getScan, getScanPdf } from "../../../modules/scan/scan.controller";
import { verifyToken } from "../../../middlewares/auth.middleware";

const scanRoute = new Hono();

scanRoute.post("/scan/create", createScan);
scanRoute.get("/scan/:id", getScan);

// Optional auth for PDF (to fetch saved branding). We won't block if token is missing/invalid for public share links, but we check if it exists:
scanRoute.get("/scan/:id/pdf", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    // If they have token, verify so controller can grab branding
    await verifyToken(c, async () => {});
  }
  return getScanPdf(c);
});

export default scanRoute;
