/**
 * src/lib/errorLog.ts
 * Purpose: Track errors in production (AI failures, payment failures, scan timeouts).
 */
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

const logsDir = join(process.cwd(), "logs");

// Ensure logs directory exists
try {
  mkdirSync(logsDir, { recursive: true });
} catch (err) {
  // Ignore if it fails (e.g. read-only filesystem)
}

export function logError(context: string, error: any, metadata?: any) {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : "";
  
  const logMessage = `[${timestamp}] ${context.toUpperCase()}: ${errorMessage}\n` +
    (metadata ? `Metadata: ${JSON.stringify(metadata, null, 2)}\n` : "") +
    (stack ? `Stack: ${stack}\n` : "") +
    "-".repeat(50) + "\n";

  try {
    appendFileSync(join(logsDir, "errors.log"), logMessage);
    console.error(`[${context}] logged to errors.log: ${errorMessage}`);
  } catch (err) {
    console.error(`[${context}] failed to log to file: ${errorMessage}`);
  }
}
