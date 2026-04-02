import { db } from "../db";
import { services } from "../schema/services";
import { pages } from "../schema/pages";

const seed = async () => {
  console.log("🌱 Seeding services...");

  await db.insert(pages).values({
    slug: "service",
    title: "AI Services",
    subtitle:
      "We offer a wide range of services to help you build and grow your digital product.",
  });

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

  console.log("✅ Services seeded");
  process.exit(0);
};

seed();
