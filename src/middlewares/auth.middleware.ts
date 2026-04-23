import type { Context, Next } from "hono";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = (process.env.JWT_SECRET as string) || "super_secret_anavya";

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
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as { id: number; email: string };
    c.set("user", decoded);
    await next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return c.json({ success: false, message: "Token expired." }, 401);
    }
    return c.json({ success: false, message: "Invalid token." }, 401);
  }
};
