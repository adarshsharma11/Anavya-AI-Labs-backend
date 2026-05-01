import { getSettingsRepo, getSettingByKeyRepo, upsertSettingRepo } from "./settings.repository";

export const getSiteSettingsService = async () => {
  const allSettings = await getSettingsRepo();
  const settingsMap: Record<string, string> = {};
  
  // Default fallbacks in case DB is empty
  settingsMap["companyName"] = "Anavya AI Labs";
  settingsMap["domain"] = "anavyaailabs.com";
  settingsMap["effectiveDate"] = "2026-05-01";
  settingsMap["email"] = "support@anavyaailabs.com";

  for (const setting of allSettings) {
    settingsMap[setting.key] = setting.value;
  }

  return settingsMap;
};

export const updateSettingService = async (key: string, value: string) => {
  return await upsertSettingRepo(key, value);
};
