import app from './app'
import { validateProductionEnv } from './lib/validateEnv'
import { scheduleBlogGeneration } from './jobs/blogGenerationCron'

// Validate environment in production
const envCheck = validateProductionEnv();
if (!envCheck.valid) {
  console.error("❌ Production env invalid:");
  envCheck.errors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
}



// Start cron jobs in production
if (process.env.NODE_ENV === "production") {
  scheduleBlogGeneration();
}

import { env } from './config/env'

const port = Number(env.PORT) || 3001;

export default {
  port,
  fetch: app.fetch,
}
