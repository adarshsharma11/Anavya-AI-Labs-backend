import "dotenv/config";

import { seedBlogs } from "./blogs.seed";
import { seedPricing } from "./pricing.seed";
import { seedServices } from "./services.seed";
import { seedPortfolio } from "./portfolio.seed";

async function runSeeds() {
  try {
    console.log(" Running seeds...");

    await seedBlogs();
    await seedPricing();
    await seedServices();
    await seedPortfolio();

    console.log("All seeds completed");
  } catch (error) {
    console.error(" Seed failed:", error);
  }
}

runSeeds();