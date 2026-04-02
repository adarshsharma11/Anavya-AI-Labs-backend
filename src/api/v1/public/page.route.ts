import { Hono } from "hono";
import { getPage, createPage, updatePage } from "../../../modules/pages/pages.controller";

const app = new Hono();

// public get
app.get("/page", getPage);

// admin seed/create
app.post("/page", createPage);

// admin update
app.put("/page", updatePage);

export default app;
