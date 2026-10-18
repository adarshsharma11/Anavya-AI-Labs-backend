import "dotenv/config";

import { seedBlogs } from "./blogs.seed.js";
import { seedPricing } from "./pricing.seed.js";
import { seedServices } from "./services.seed.js";
import { seedPortfolio } from "./portfolio.seed.js";
import { seedAbout } from "./about.seed.js";
import { seedAdmin } from "./admin.seed.js";

async function runSeeds() {
  try {
    console.log(" Running seeds...");

    await seedBlogs();
    await seedPricing();
    await seedServices();
    await seedPortfolio();
    await seedAbout();
    await seedAdmin();

    console.log("All seeds completed");
  } catch (error) {
    console.error(" Seed failed:", error);
  }
}

runSeeds();