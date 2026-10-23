import { waitUntil } from "@vercel/functions";
import { logError } from "./errorLog.js";

export function runInBackground(context: string, task: Promise<unknown>) {
  const guarded = task.catch((err) => logError(context, err));
  waitUntil(guarded);
}
