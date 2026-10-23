export function logError(context: string, error: unknown, metadata?: unknown) {
  const err = error instanceof Error ? error : new Error(String(error));

  console.error(
    JSON.stringify({
      level: "error",
      context: context.toUpperCase(),
      message: err.message,
      metadata: metadata ?? null,
      stack: err.stack ?? null,
      timestamp: new Date().toISOString(),
    }),
  );
}
