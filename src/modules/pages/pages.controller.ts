import type { Context } from "hono";
import {
  getPageBySlugService,
  createPageService,
  updatePageService,
} from "./pages.service";

export const getPage = async (c: Context) => {
  const slug = c.req.query("slug");
  if (!slug) {
    c.status(400);
    return c.json({ success: false, message: "Slug parameter is required" });
  }

  const data = await getPageBySlugService(slug);
  if (!data) {
    c.status(404);
    return c.json({ success: false, message: "Page not found" });
  }

  return c.json({ success: true, data });
};

export const createPage = async (c: Context) => {
  const body = await c.req.json();
  if (!body.slug || !body.title) {
    c.status(400);
    return c.json({ success: false, message: "Slug and Title are required" });
  }

  try {
    const res = await createPageService(body);
    return c.json({ success: true, data: res });
  } catch (error: any) {
    if (error.message && error.message.includes("duplicate key value") || error.code === '23505') {
      c.status(409);
      return c.json({ success: false, message: "A page with this slug already exists." });
    }
    c.status(500);
    return c.json({ success: false, message: error.message });
  }
};

export const updatePage = async (c: Context) => {
  const slug = c.req.query("slug");
  if (!slug) {
    c.status(400);
    return c.json({ success: false, message: "Slug parameter is required" });
  }

  const body = await c.req.json();

  const data = await updatePageService(slug, body);
  if (!data) {
    c.status(404);
    return c.json({ success: false, message: "Page not found" });
  }

  return c.json({ success: true, data });
};
