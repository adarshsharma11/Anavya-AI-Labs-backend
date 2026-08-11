import { Hono } from "hono";
import { runGeoCheck } from "../../../modules/geo/geo.controller";

const geoRoute = new Hono();

// Match POST /api/geo/check and POST /api/v1/geo/check
geoRoute.post("/geo/check", runGeoCheck);

export default geoRoute;
