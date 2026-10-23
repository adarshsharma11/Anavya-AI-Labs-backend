const PLACEHOLDER_HINTS = ["your_", "placeholder", "super_secret"];

export function isProduction() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function requireSecret(name: string, devFallback: string) {
  const value = process.env[name];
  if (value && !PLACEHOLDER_HINTS.some((hint) => value.includes(hint))) {
    return value;
  }
  if (isProduction()) {
    throw new Error(`${name} is not configured`);
  }
  return devFallback;
}

export const getJwtSecret = () => requireSecret("JWT_SECRET", "dev_only_jwt_secret");
export const getAdminApiKey = () => requireSecret("ADMIN_API_KEY", "dev_only_admin_key");
export const getCronSecret = () => requireSecret("CRON_SECRET", "dev_only_cron_secret");
