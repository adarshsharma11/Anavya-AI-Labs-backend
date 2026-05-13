import "dotenv/config";

import { seedBlogs } from "./blogs.seed";
import { seedPricing } from "./pricing.seed";
import { seedServices } from "./services.seed";

async function runSeeds() {
  try {
    console.log(" Running seeds...");

    await seedBlogs();
    await seedPricing();
    await seedServices();

    console.log("All seeds completed");
  } catch (error) {
    console.error(" Seed failed:", error);
  }
}

runSeeds();