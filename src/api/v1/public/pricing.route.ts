import { Hono } from "hono";
import {
  getPublicPlans,
  getSinglePlan,
} from "../../../modules/pricing/pricing.controller";

const pricingRoute = new Hono();

pricingRoute.get("/pricing", getPublicPlans);
pricingRoute.get("/pricing/:id", getSinglePlan);

export default pricingRoute;
