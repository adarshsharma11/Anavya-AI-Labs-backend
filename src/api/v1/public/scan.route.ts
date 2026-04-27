import { Hono } from "hono";
import { createScan, getScan, getScanPdf } from "../../../modules/scan/scan.controller";
import { optionalVerifyToken } from "../../../middlewares/auth.middleware";


const scanRoute = new Hono();

scanRoute.post("/scan/create", optionalVerifyToken, createScan);
scanRoute.get("/scan/:id", getScan);

// Optional auth for PDF (to fetch saved branding)
scanRoute.get("/scan/:id/pdf", optionalVerifyToken, getScanPdf);


export default scanRoute;
