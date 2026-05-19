import { db } from "../db";
import { portfolio } from "../schema/portfolio";

export const fallbackPortfolioData = [
  {
    slug: "ecommerce-platform",
    title: "E-commerce Platform",
    summary: "A headless storefront with real-time inventory, curated bundles, and rapid checkout.",
    tags: ["E-commerce", "UX", "Performance"],
    imageKey: "portfolio-1",
  },
  {
    slug: "saas-growth-dashboard",
    title: "SaaS Growth Dashboard",
    summary: "An analytics command center that turns churn signals into weekly retention wins.",
    tags: ["SaaS", "Analytics", "B2B"],
    imageKey: "portfolio-2",
  },
  {
    slug: "mobile-banking-app",
    title: "Mobile Banking App",
    summary: "A secure mobile experience redesigned for speed, trust, and instant onboarding.",
    tags: ["Fintech", "Mobile", "Security"],
    imageKey: "portfolio-3",
  },
  {
    slug: "ai-support-chatbot",
    title: "AI Support Chatbot",
    summary: "A GPT-powered support assistant that deflects 42% of tickets in week one.",
    tags: ["Chatbot", "AI", "Support"],
    imageKey: "portfolio-4",
  },
  {
    slug: "conversational-commerce",
    title: "Conversational Commerce",
    summary: "A guided shopping flow that turns product discovery into real-time conversations.",
    tags: ["Commerce", "Conversation", "Growth"],
    imageKey: "portfolio-5",
  },
  {
    slug: "knowledge-base-assistant",
    title: "Knowledge Base Assistant",
    summary: "An internal assistant that answers policy and process questions instantly.",
    tags: ["AI", "Knowledge", "Ops"],
    imageKey: "portfolio-6",
  },
];

export async function seedPortfolio() {
  const existingPortfolio = await db.query.portfolio.findMany();

  if (existingPortfolio.length > 0) {
    console.log("Portfolio already exists. Skipping seed.");
    return;
  }

  await db.insert(portfolio).values(fallbackPortfolioData);

  console.log("✓ Default portfolio seeded");
}
