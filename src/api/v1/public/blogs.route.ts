import { Hono } from "hono";
import {
  getBlogs,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
} from "../../../modules/blogs/blogs.controller";

const app = new Hono();

app.get("/blogs", getBlogs);
app.get("/blogs/:slug", getBlogBySlug);
app.post("/blogs", createBlog);
app.put("/blogs/:slug", updateBlog);
app.delete("/blogs/:slug", deleteBlog);

export default app;
