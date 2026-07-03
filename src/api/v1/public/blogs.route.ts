import { Hono } from "hono";
import {
  getBlogs,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
} from "../../../modules/blogs/blogs.controller";

import { verifyAdminToken } from "../../../middlewares/auth.middleware";

const app = new Hono();

app.get("/blogs", getBlogs);
app.get("/blogs/:slug", getBlogBySlug);

// Only admin authorized for blog management
app.post("/blogs", verifyAdminToken, createBlog);
app.put("/blogs/:slug", verifyAdminToken, updateBlog);
app.delete("/blogs/:slug", verifyAdminToken, deleteBlog);

export default app;
