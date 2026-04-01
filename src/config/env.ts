import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotEnv } from "dotenv";

const nodeEnv = process.env.NODE_ENV;
const envPath = resolve(
  process.cwd(),
  nodeEnv === "production" ? ".env" : ".env.development",
);

if (existsSync(envPath)) {
  console.log(`Loading environment variables from ${envPath}`);
  loadDotEnv({ path: envPath });
} else if (nodeEnv !== "production") {
  console.log("Loading environment variables from .env");
  loadDotEnv();
}

export const env = {
  PORT: process.env.PORT || "3001",
  DATABASE_URL: process.env.DATABASE_URL || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "",
};
