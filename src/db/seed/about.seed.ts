import { db } from "../db";
import { about } from "../schema/about";

export const fallbackAboutData = [
  {
    title: "We turn AI insights into product momentum.",
    description: "Anavya AI Labs helps ambitious teams deliver faster, more accessible web experiences. We blend AI diagnostics with human strategy to unlock real revenue wins, not just prettier dashboards.",
    badges: ["UX + AI Strategy", "Performance Engineering", "Conversion Design"],
    imageUrl: "https://images.unsplash.com/photo-1543269865-cbf427effbad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw5fHx0ZWFtJTIwY29sbGFib3JhdGlvbnxlbnwwfHx8fDE3Njc2OTE5MDZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    imageHint: "team collaboration",
    highlights: [
      { value: "120+", label: "Sites analyzed", detail: "Across SaaS, fintech, and retail." },
      { value: "4.9/5", label: "Client rating", detail: "Measured after every launch." },
      { value: "38%", label: "Avg. lift", detail: "Conversion wins within 90 days." }
    ],
    principles: [
      { title: "Human-first AI", description: "We automate the tedious parts, so teams can focus on the decisions that move the needle." },
      { title: "Performance obsessed", description: "Speed budgets, strict accessibility checks, and measurable impact at every release." },
      { title: "Design with intent", description: "Every screen is mapped to user intent with clear hierarchy and conversion flow." }
    ],
    culture: [
      { title: "Small, senior squads", description: "You work with a tight team of senior builders who ship quickly and stay accountable." },
      { title: "Transparent collaboration", description: "Weekly demos, shared dashboards, and candid advice on what to prioritize next." },
      { title: "Always learning", description: "We test new models, frameworks, and UX patterns weekly to keep results modern." }
    ]
  },
  {
    title: "Blending Artificial Intelligence with Human Ingenuity.",
    description: "We help companies audit, optimize, and scale their web products using next-generation AI agents. Our platforms deliver deep visibility into customer behavior, site responsiveness, and digital performance.",
    badges: ["AI Auditing", "UX Optimization", "Core Web Vitals"],
    imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
    imageHint: "developer workshop",
    highlights: [
      { value: "300+", label: "Audits delivered", detail: "Serving enterprise and mid-market teams." },
      { value: "99.9%", label: "Uptime verified", detail: "Ensuring continuous optimization." },
      { value: "45%", label: "Conversion uplift", detail: "Delivered through target experiments." }
    ],
    principles: [
      { title: "Continuous Diagnostics", description: "Constant automated health checks for your entire digital storefront." },
      { title: "Actionable Analytics", description: "No fluff metrics. We deliver specific line-of-code recommendations." },
      { title: "Seamless Integration", description: "Instantly plugs into your deployment pipeline and analytical dashboards." }
    ],
    culture: [
      { title: "Velocity Over Everything", description: "We build fast, test early, and ship continuous upgrades daily." },
      { title: "Data-Driven Mindset", description: "Every design decision is supported by telemetry and conversion numbers." },
      { title: "Radical Openness", description: "We discuss failures openly to build stronger, more resilient architectures." }
    ]
  },
  {
    title: "Enterprise-Grade Digital Performance Analysis.",
    description: "Anavya AI Labs powers digital growth for leading brands by automating core web vitals auditing and accessibility compliance checks. We identify friction points using machine learning models.",
    badges: ["Enterprise Performance", "Accessibility Auditing", "Growth Marketing"],
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
    imageHint: "modern office setup",
    highlights: [
      { value: "500M+", label: "Monthly requests", detail: "Monitoring critical customer journeys." },
      { value: "24/7", label: "Live assistance", detail: "Dedicated Slack support channels." },
      { value: "2.1x", label: "ROI multiplier", detail: "Measured across initial pilot campaigns." }
    ],
    principles: [
      { title: "Security & Compliance", description: "Strict adherence to WCAG 2.2, GDPR, and enterprise data privacy." },
      { title: "Scalability First", description: "Designed to monitor thousands of subdomains and landing pages automatically." },
      { title: "Empowered Teams", description: "We hand developers the exact solutions, bypassing endless diagnostic steps." }
    ],
    culture: [
      { title: "Senior Ownership", description: "Engineers handle relationships directly, ensuring deep alignment." },
      { title: "Strict Transparency", description: "Clear pricing, direct communication, and open source scanning engines." },
      { title: "User Centered", description: "We test with actual users alongside simulation scripts to ensure accuracy." }
    ]
  }
];

export async function seedAbout() {
  const existingAbout = await db.query.about.findMany();

  if (existingAbout.length > 0) {
    console.log("About pages already exist. Skipping seed.");
    return;
  }

  const primarySeed = fallbackAboutData[0];
  if (!primarySeed) {
    console.log("No seed data found in fallbackAboutData. Skipping seed.");
    return;
  }

  await db.insert(about).values(primarySeed);

  console.log("✓ About page seeded");
}

export default seedAbout;
