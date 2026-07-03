import { Hono } from "hono";
import {
  getPortfolio,
  getPortfolioBySlug,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
} from "../../../modules/portfolio/portfolio.controller";

import { verifyAdminToken } from "../../../middlewares/auth.middleware";

const app = new Hono();

app.get("/portfolio", getPortfolio);
app.get("/portfolio/:slug", getPortfolioBySlug);

// Only admin authorized for portfolio management
app.post("/portfolio", verifyAdminToken, createPortfolio);
app.put("/portfolio/:slug", verifyAdminToken, updatePortfolio);
app.delete("/portfolio/:slug", verifyAdminToken, deletePortfolio);

export default app;
