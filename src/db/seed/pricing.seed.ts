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
  ];

  await db.insert(plans).values(data);

  console.log("✓ Pricing seeded");
}