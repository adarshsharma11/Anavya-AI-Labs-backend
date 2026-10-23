import { Hono } from "hono";
import { runGeoCheck } from "../../../modules/geo/geo.controller.js";
import { optionalVerifyToken } from "../../../middlewares/auth.middleware.js";

const geoRoute = new Hono();

// Match POST /api/geo/check and POST /api/v1/geo/check
geoRoute.post("/geo/check", optionalVerifyToken, runGeoCheck);

export default geoRoute;
