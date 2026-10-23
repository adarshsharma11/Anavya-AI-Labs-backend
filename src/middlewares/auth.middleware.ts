import type { Context, Next } from "hono";
import jwt from "jsonwebtoken";

import { getAdminApiKey, getJwtSecret } from "../lib/secrets.js";

export const verifyToken = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ success: false, message: "Unauthorized. Token missing." }, 401);
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return c.json({ success: false, message: "Unauthorized. Token missing." }, 401);
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as unknown as { id: number; email: string };
    c.set("user", decoded);
    await next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return c.json({ success: false, message: "Token expired." }, 401);
    }
    return c.json({ success: false, message: "Invalid token." }, 401);
  }
};
export const optionalVerifyToken = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, getJwtSecret()) as unknown as { id: number; email: string };
        c.set("user", decoded);
      } catch (err) {
        // Silently fail for optional auth
      }
    }
  }
  await next();
};

export const verifyAdmin = async (c: Context, next: Next) => {
  const adminKey = c.req.header("x-admin-key");
  if (!adminKey || adminKey !== getAdminApiKey()) {
    return c.json({ success: false, message: "Unauthorized. Admin access required." }, 401);
  }

  await next();
};

export const verifyAdminToken = async (c: Context, next: Next) => {
  let isAuthed = false;
  const res = await verifyToken(c, async () => {
    isAuthed = true;
  });

  if (!isAuthed) {
    return res;
  }

  const user = c.get("user") as { id: number; email: string; role?: string } | undefined;
  if (!user || user.role !== "admin") {
    return c.json({ success: false, message: "Forbidden. Admin access required." }, 403);
  }

  await next();
};

