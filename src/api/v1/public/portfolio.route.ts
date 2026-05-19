import { Hono } from "hono";
import {
  getPortfolio,
  getPortfolioBySlug,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
} from "../../../modules/portfolio/portfolio.controller";

const app = new Hono();

app.get("/portfolio", getPortfolio);
app.get("/portfolio/:slug", getPortfolioBySlug);

// Publicly managed portfolio items (no auth required, exactly like blogs)
app.post("/portfolio", createPortfolio);
app.put("/portfolio/:slug", updatePortfolio);
app.delete("/portfolio/:slug", deletePortfolio);

export default app;
