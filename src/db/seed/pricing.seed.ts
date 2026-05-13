import { db } from "../db";
import { plans, type InsertPlan } from "../schema/plan";

export async function seedPricing() {
  const existingPlans = await db.query.plans.findMany();

  if (existingPlans.length > 0) {
    console.log("Pricing already exists. Skipping.");
    return;
  }

  const data: InsertPlan[] = [
    {
      name: "Free",
      description: "Get a baseline scan to see immediate issues and quick wins.",
      price: 0,
      compareAtPrice: null,
      discountPercent: null,
      cadence: "first scan",
      type: "free",
      features: [
        "1 full scan included",
        "Performance + SEO + accessibility",
        "Shareable summary report",
        "Action checklist",
      ],
      cta: "Start Free",
      scanLimit: 1,
      badge: null,
      isHighlighted: false,
      active: true,
    },
    {
      name: "Full Report",
      description: "Unlock the complete AI audit report and download it instantly.",
      price: 299,
      compareAtPrice: 500,
      discountPercent: 40,
      cadence: "per report",
      type: "one_time",
      features: [
        "Full issue breakdown",
        "AI recommendations",
        "Downloadable report",
        "Premium insights",
      ],
      cta: "Unlock Report",
      scanLimit: 1,
      badge: "Save $2.01",
      isHighlighted: true,
      active: true,
    },
    {
      name: "Pro Monthly",
      description: "Unlimited scans and monitoring for teams shipping every week.",
      price: 4900,
      compareAtPrice: null,
      discountPercent: null,
      cadence: "per month",
      type: "subscription",
      features: [
        "Unlimited scans",
        "Historical trend tracking",
        "Advanced performance insights",
        "Email + Slack alerts",
      ],
      cta: "Go Pro",
      scanLimit: -1,
      badge: null,
      isHighlighted: false,
      active: true,
    },
  ];

  await db.insert(plans).values(data);

  console.log("✓ Pricing seeded");
}