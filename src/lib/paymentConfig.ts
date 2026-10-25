import type { Context } from "hono";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { plans } from "../db/schema/plan.js";
import { getUsdToInrRate } from "./fx.js";
import { logError } from "./errorLog.js";

export type PaymentRegion = "IN" | "INTL";

/** Fallback when no active one_time plan exists. */
export const PAYMENT_BASE_USD = Number(process.env.PAYMENT_BASE_USD || "2.99");
export const GST_RATE_PERCENT = 18;

export type PaymentQuote = {
  region: PaymentRegion;
  currency: "INR" | "USD";
  /** Price before tax, in major units. */
  base: number;
  gstAmount: number;
  gstRatePercent: number;
  total: number;
  amountSubunits: number;
  usdToInrRate?: number;
};

/** India pays INR at the live rate plus 18% GST, rounded to whole rupees; everyone else pays the USD list price. */
export function priceForRegion(usd: number, region: PaymentRegion, usdToInrRate: number): PaymentQuote {
  if (region === "INTL") {
    return {
      region,
      currency: "USD",
      base: usd,
      gstAmount: 0,
      gstRatePercent: 0,
      total: usd,
      amountSubunits: Math.round(usd * 100),
    };
  }
  const base = Math.round(usd * usdToInrRate);
  const gstAmount = Math.round((base * GST_RATE_PERCENT) / 100);
  const total = base + gstAmount;
  return {
    region,
    currency: "INR",
    base,
    gstAmount,
    gstRatePercent: GST_RATE_PERCENT,
    total,
    amountSubunits: total * 100,
    usdToInrRate: Math.round(usdToInrRate * 100) / 100,
  };
}

export async function quoteUsd(usd: number, region: PaymentRegion): Promise<PaymentQuote> {
  return priceForRegion(usd, region, region === "IN" ? await getUsdToInrRate() : 0);
}

export function resolveRegion(value: unknown, c: Context): PaymentRegion {
  if (value === "IN" || value === "INTL") return value;

  const header = c.req.header("x-client-region");
  if (header === "IN" || header === "INTL") return header;

  const country = c.req.header("x-vercel-ip-country") ?? c.req.header("cf-ipcountry");
  return country === "IN" ? "IN" : "INTL";
}

export async function getReportBaseUsd() {
  try {
    const res = await db
      .select({ price: plans.price })
      .from(plans)
      .where(and(eq(plans.type, "one_time"), eq(plans.active, true)))
      .orderBy(asc(plans.price))
      .limit(1);
    const cents = Number(res[0]?.price);
    if (Number.isFinite(cents) && cents > 0) return cents / 100;
  } catch (err) {
    logError("QUOTE_PLAN_PRICE", err);
  }
  return PAYMENT_BASE_USD;
}

export async function getPaymentQuote(region: PaymentRegion): Promise<PaymentQuote> {
  return quoteUsd(await getReportBaseUsd(), region);
}
