import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotEnv } from "dotenv";

const nodeEnv = process.env.NODE_ENV;
const envFilenames = nodeEnv === "production" ? [".env"] : [".env.development", ".env"];

for (const filename of envFilenames) {
  const envPath = resolve(process.cwd(), filename);
  if (existsSync(envPath)) {
    loadDotEnv({ path: envPath });
    break;
  }
}

export const env = {
  PORT: process.env.PORT || "3001",
  DATABASE_URL: process.env.DATABASE_URL || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  FRONTEND_URL: process.env.FRONTEND_URL || "https://anavyaailabs.com",
  NODE_ENV: process.env.NODE_ENV || "development",
};
