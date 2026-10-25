import axios from "axios";
import { getSettingByKeyRepo, upsertSettingRepo } from "../modules/settings/settings.repository.js";
import { logError } from "./errorLog.js";

export const USD_TO_INR_OVERRIDE_KEY = "usd_to_inr_override";
const LIVE_RATE_KEY = "usd_to_inr_live";
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;
const MEMORY_TTL_MS = 10 * 60 * 1000;
const DEFAULT_USD_TO_INR = 84;

type CachedRate = { rate: number; fetchedAt: number };

let memory: CachedRate | null = null;

const positive = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const sane = (rate: number | null) => (rate && rate > 40 && rate < 200 ? rate : null);

const fetchLiveRate = async (): Promise<number | null> => {
  const sources = [
    async () => (await axios.get("https://open.er-api.com/v6/latest/USD", { timeout: 5000 })).data?.rates?.INR,
    async () => (await axios.get("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR", { timeout: 5000 })).data?.rates?.INR,
  ];
  for (const source of sources) {
    try {
      const rate = sane(positive(await source()));
      if (rate) return rate;
    } catch (err) {
      logError("FX_FETCH", err);
    }
  }
  return null;
};

const readStored = async (): Promise<CachedRate | null> => {
  try {
    const row = await getSettingByKeyRepo(LIVE_RATE_KEY);
    if (!row) return null;
    const parsed = JSON.parse(row.value) as Partial<CachedRate>;
    const rate = sane(positive(parsed.rate));
    return rate ? { rate, fetchedAt: Number(parsed.fetchedAt) || 0 } : null;
  } catch (err) {
    logError("FX_READ", err);
    return null;
  }
};

/** Live USD→INR rate: admin override, then a cached market rate refreshed every 12h, then env or a default. */
export async function getUsdToInrRate(): Promise<number> {
  const now = Date.now();
  if (memory && now - memory.fetchedAt < MEMORY_TTL_MS) return memory.rate;

  try {
    const override = sane(positive((await getSettingByKeyRepo(USD_TO_INR_OVERRIDE_KEY))?.value));
    if (override) {
      memory = { rate: override, fetchedAt: now };
      return override;
    }
  } catch (err) {
    logError("FX_OVERRIDE", err);
  }

  const stored = await readStored();
  if (stored && now - stored.fetchedAt < REFRESH_AFTER_MS) {
    memory = { rate: stored.rate, fetchedAt: now };
    return stored.rate;
  }

  const live = await fetchLiveRate();
  if (live) {
    await upsertSettingRepo(LIVE_RATE_KEY, JSON.stringify({ rate: live, fetchedAt: now })).catch((err) =>
      logError("FX_SAVE", err),
    );
    memory = { rate: live, fetchedAt: now };
    return live;
  }

  const fallback = stored?.rate ?? sane(positive(process.env.USD_TO_INR_RATE)) ?? DEFAULT_USD_TO_INR;
  memory = { rate: fallback, fetchedAt: now };
  return fallback;
}
