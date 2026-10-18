import app from './app'
import { validateProductionEnv } from './lib/validateEnv'
import { scheduleBlogGeneration } from './jobs/blogGenerationCron'
import { env } from './config/env'

const isVercel = process.env.VERCEL === '1'

if (!isVercel) {
  const envCheck = validateProductionEnv();
  if (!envCheck.valid) {
    console.error("Production env invalid:");
    envCheck.errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

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
