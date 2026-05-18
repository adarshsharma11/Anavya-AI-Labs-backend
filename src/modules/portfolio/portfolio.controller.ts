import type { Context } from "hono";
import {
  getPortfolioService,
  getPortfolioBySlugService,
  createPortfolioService,
  updatePortfolioService,
  deletePortfolioService,
} from "./portfolio.service";
import { fallbackPortfolioData } from "../../db/seed/portfolio.seed";

export const getPortfolio = async (c: Context) => {
  try {
    const data = await getPortfolioService();
    if (!data || data.length === 0) {
      const fallbackWithIds = fallbackPortfolioData.map((item, index) => ({
        id: index + 1,
        ...item
      }));
      return c.json({ success: true, data: fallbackWithIds });
    }
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const getPortfolioBySlug = async (c: Context) => {
  try {
    const slug = c.req.param("slug");
    const data = await getPortfolioBySlugService(slug);
    
    if (!data) {
      return c.json({ success: false, message: "Portfolio item not found" }, 404);
    }
    
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const createPortfolio = async (c: Context) => {
  try {
    const body = await c.req.json();

    if (!body.slug || !body.title || !body.summary || !body.tags) {
      return c.json({ success: false, message: "Missing required fields (slug, title, summary, tags)" }, 400);
    }

    // Check if portfolio with slug already exists
    const existing = await getPortfolioBySlugService(body.slug);
    if (existing) {
      return c.json({ success: false, message: "A portfolio item with this slug already exists." }, 409);
    }

    // Ensure imageKey exists, default to placeholder if not provided
    if (!body.imageKey) {
      body.imageKey = `portfolio-1`;
    }

    const res = await createPortfolioService(body);

    return c.json({ success: true, data: res });

  } catch (error: any) {
    console.error("CREATE PORTFOLIO ERROR:", error);
    return c.json(
      {
        success: false,
        message: error?.message,
        detail: error?.detail,
        stack: error?.stack,
        error,
      },
      500
    );
  }
};

export const updatePortfolio = async (c: Context) => {
  try {
    const slug = c.req.param("slug");
    const body = await c.req.json();
    const res = await updatePortfolioService(slug, body);
    
    if (!res) {
      return c.json({ success: false, message: "Portfolio item not found for update" }, 404);
    }
    
    return c.json({ success: true, data: res });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const deletePortfolio = async (c: Context) => {
  try {
    const slug = c.req.param("slug");
    const res = await deletePortfolioService(slug);
    
    if (!res) {
      return c.json({ success: false, message: "Portfolio item not found for deletion" }, 404);
    }
    
    return c.json({ success: true, data: res });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};
