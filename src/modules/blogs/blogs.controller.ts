import type { Context } from "hono";
import {
  getBlogsService,
  getBlogBySlugService,
  createBlogService,
  updateBlogService,
  deleteBlogService,
} from "./blogs.service";

export const getBlogs = async (c: Context) => {
  try {
    const data = await getBlogsService();
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
    const res = await createBlogService(body);
    return c.json({ success: true, data: res });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
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
