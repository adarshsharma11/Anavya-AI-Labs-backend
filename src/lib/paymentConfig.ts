import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { plans } from "../db/schema/plan.js";
import { getSettingByKeyRepo } from "../modules/settings/settings.repository.js";
import { logError } from "./errorLog.js";

export type PaymentRegion = "IN" | "INTL";

/** Fallback when no active one_time plan exists: $2.99 USD with 18% GST included. */
export const PAYMENT_BASE_USD = Number(process.env.PAYMENT_BASE_USD || "2.99");
export const GST_RATE_PERCENT = 18;
export const DEFAULT_USD_TO_INR_RATE = 80.84;
export const USD_TO_INR_SETTING_KEY = "usd_to_inr_rate";

export type PaymentQuote = {
  region: PaymentRegion;
  currency: "INR" | "USD";
  total: number;
  amountSubunits: number;
  gstInclusive: true;
  gstRatePercent: number;
  usdToInrRate?: number;
};

const positiveNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function getReportBaseUsd() {
  try {
    const res = await db
      .select({ price: plans.price })
      .from(plans)
      .where(and(eq(plans.type, "one_time"), eq(plans.active, true)))
      .orderBy(asc(plans.price))
      .limit(1);
    const cents = positiveNumber(res[0]?.price);
    if (cents) return cents / 100;
  } catch (err) {
    logError("QUOTE_PLAN_PRICE", err);
  }
  return PAYMENT_BASE_USD;
}

export async function getUsdToInrRate() {
  try {
    const setting = await getSettingByKeyRepo(USD_TO_INR_SETTING_KEY);
    const fromSetting = positiveNumber(setting?.value);
    if (fromSetting) return fromSetting;
  } catch (err) {
    logError("QUOTE_INR_RATE", err);
  }
  return positiveNumber(process.env.USD_TO_INR_RATE) ?? DEFAULT_USD_TO_INR_RATE;
}

export async function getPaymentQuote(region: PaymentRegion): Promise<PaymentQuote> {
  const baseUsd = await getReportBaseUsd();

  if (region === "INTL") {
    return {
      region,
      currency: "USD",
      total: baseUsd,
      amountSubunits: Math.round(baseUsd * 100),
      gstInclusive: true,
      gstRatePercent: GST_RATE_PERCENT,
    };
  }

  const rate = await getUsdToInrRate();
  const totalInr =
    Math.round(baseUsd * rate * (1 + GST_RATE_PERCENT / 100) * 100) / 100;

  return {
    region,
    currency: "INR",
    total: totalInr,
    amountSubunits: Math.round(totalInr * 100),
    gstInclusive: true,
    gstRatePercent: GST_RATE_PERCENT,
    usdToInrRate: rate,
  };
}
