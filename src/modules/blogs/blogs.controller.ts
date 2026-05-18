import type { Context } from "hono";
import {
  getBlogsService,
  getBlogBySlugService,
  createBlogService,
  updateBlogService,
  deleteBlogService,
} from "./blogs.service";
import { fallbackBlogsData } from "../../db/seed/blogs.seed";

export const getBlogs = async (c: Context) => {
  try {
    const data = await getBlogsService();
    if (!data || data.length === 0) {
      return c.json({ success: true, data: fallbackBlogsData });
    }
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const getBlogBySlug = async (c: Context) => {
  try {
    const slug = c.req.param("slug");
    const data = await getBlogBySlugService(slug);
    
    if (!data) {
      return c.json({ success: false, message: "Blog not found" }, 404);
    }
    
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const createBlog = async (c: Context) => {
  try {
    const body = await c.req.json();

    if (!body.slug || !body.title || !body.content) {
      return c.json({ success: false, message: "Missing required fields (slug, title, content)" }, 400);
    }

    // Check if blog with slug already exists
    const existingBlog = await getBlogBySlugService(body.slug);
    if (existingBlog) {
      return c.json({ success: false, message: "A blog with this slug already exists." }, 409);
    }

    // Calculate readTime if missing
    if (!body.readTime) {
      const words = Array.isArray(body.content) 
        ? body.content.join(" ").split(" ").length 
        : (body.content || "").split(" ").length;
      const minutes = Math.max(1, Math.ceil(words / 200));
      body.readTime = `${minutes} min read`;
    }

    const res = await createBlogService(body);

    return c.json({ success: true, data: res });

  } catch (error: any) {

    console.error("CREATE BLOG ERROR:", error);

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

export const updateBlog = async (c: Context) => {
  try {
    const slug = c.req.param("slug");
    const body = await c.req.json();
    const res = await updateBlogService(slug, body);
    
    if (!res) {
      return c.json({ success: false, message: "Blog not found for update" }, 404);
    }
    
    return c.json({ success: true, data: res });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const deleteBlog = async (c: Context) => {
  try {
    const slug = c.req.param("slug");
    const res = await deleteBlogService(slug);
    
    if (!res) {
      return c.json({ success: false, message: "Blog not found for deletion" }, 404);
    }
    
    return c.json({ success: true, data: res });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};
