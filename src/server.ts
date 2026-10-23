import app from './app.js'
import { validateProductionEnv } from './lib/validateEnv.js'
import { scheduleBlogGeneration } from './jobs/blogGenerationCron.js'
import { env } from './config/env.js'

const isVercel = process.env.VERCEL === '1'

const envCheck = validateProductionEnv();
if (!envCheck.valid) {
  console.error("Production env invalid:");
  envCheck.errors.forEach(err => console.error(`  - ${err}`));
  if (!isVercel) process.exit(1);
}

if (!isVercel) {
  if (process.env.NODE_ENV === "production") {
    scheduleBlogGeneration();
  }
}

const port = Number(env.PORT) || 3001;

export default isVercel
  ? app
  : {
      port,
      hostname: "0.0.0.0",
      fetch: app.fetch,
    }
