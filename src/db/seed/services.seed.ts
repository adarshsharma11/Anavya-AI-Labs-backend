import { db } from "../db";
import { services } from "../schema/services";
import { pages } from "../schema/pages";
import { eq } from "drizzle-orm";

export async function seedServices() {
  const existingPage = await db.query.pages.findFirst({
    where: eq(pages.slug, "service"),
  });

  if (!existingPage) {
    await db.insert(pages).values({
      slug: "service",
      title: "AI Services",
      subtitle:
        "We offer a wide range of services to help you build and grow your digital product.",
    });

    console.log("✓ Service page seeded");
  } else {
    console.log("✓ Service page already exists. Skipping.");
  }

  // ===== SERVICES CHECK =====
  const existingServices = await db.query.services.findMany();

  if (existingServices.length === 0) {
    await db.insert(services).values([
      {
        slug: "ai-chatbot-development",
        title: "AI Chatbot Development",
        description: "We build intelligent AI chatbots...",
        icon: "Bot",
        cta: { label: "Get a quote", href: "/pricing" },
      },
      {
        slug: "custom-ai-solutions",
        title: "Custom AI Solutions",
        description: "Leverage machine learning...",
        icon: "BrainCircuit",
        cta: { label: "Talk to us", href: "/about" },
      },
    ]);

    console.log("✓ Services seeded");
  } else {
    console.log("✓ Services already exist. Skipping.");
  }
};

export default seedServices;