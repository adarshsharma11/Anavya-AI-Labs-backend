import { Hono } from "hono";
import {
  getBlogs,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
} from "../../../modules/blogs/blogs.controller";

import { verifyToken } from "../../../middlewares/auth.middleware";

const app = new Hono();

app.get("/blogs", getBlogs);
app.get("/blogs/:slug", getBlogBySlug);

// Protected administrative routes
app.post("/blogs", verifyToken, createBlog);
app.put("/blogs/:slug", verifyToken, updateBlog);
app.delete("/blogs/:slug", verifyToken, deleteBlog);

export default app;
