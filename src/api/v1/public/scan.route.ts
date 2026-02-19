import { Hono } from "hono";
import { createScan, getScan } from "../../../modules/scan/scan.controller";

const scanRoute = new Hono();

scanRoute.post("/scan/create", createScan);
scanRoute.get("/scan/:id", getScan);

export default scanRoute;
