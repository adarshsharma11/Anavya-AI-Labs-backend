import { Hono } from "hono";
import { createScan, getScan, getScanPdf } from "../../../modules/scan/scan.controller.js";
import { optionalVerifyToken } from "../../../middlewares/auth.middleware.js";


const scanRoute = new Hono();

scanRoute.post("/scan/create", optionalVerifyToken, createScan);
scanRoute.get("/scan/:id", optionalVerifyToken, getScan);
scanRoute.get("/scan/:id/pdf", optionalVerifyToken, getScanPdf);


export default scanRoute;
