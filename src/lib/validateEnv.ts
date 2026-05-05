/**
 * src/lib/validateEnv.ts
 * Purpose: Prevent silent failures in production by validating critical environment variables.
 */

export function validateProductionEnv(): { valid: boolean; errors: string[] } {
  // Only enforce validation in production
  if (process.env.NODE_ENV !== "production") {
    return { valid: true, errors: [] };
  }

  const criticalKeys = [
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "OPENAI_API_KEY",
    "DATABASE_URL",
    "SENDGRID_API_KEY",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET"
  ];

  const errors: string[] = [];

  criticalKeys.forEach((key) => {
    const value = process.env[key];
    if (!value || value.includes("your_") || value.includes("placeholder")) {
      errors.push(`${key} is missing or has a placeholder value.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
