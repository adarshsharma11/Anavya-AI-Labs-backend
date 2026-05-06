import { generateDailyBlogs } from "../services/blogGenerator";
import { logError } from "../lib/errorLog";

/**
 * src/jobs/blogGenerationCron.ts
 * Purpose: Schedules daily blog generation at 2 AM UTC.
 */

export async function scheduleBlogGeneration() {
  const scheduleNext = () => {
    const now = new Date();
    const nextRun = new Date(now);
    
    // Set to 2 AM UTC
    nextRun.setUTCHours(2, 0, 0, 0);
    
    // If it's already past 2 AM UTC today, schedule for tomorrow
    if (now >= nextRun) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }
    
    const delay = nextRun.getTime() - now.getTime();
    
    console.log(`[BlogCron] Next generation scheduled for: ${nextRun.toISOString()} (in ${Math.round(delay / 1000 / 60)} minutes)`);
    
    setTimeout(async () => {
      console.log(`[BlogCron] Starting daily blog generation...`);
      try {
        await generateDailyBlogs(5);
      } catch (err) {
        logError("BLOG_CRON", err);
      } finally {
        scheduleNext(); // Schedule the next one
      }
    }, delay);
  };

  scheduleNext();
}
