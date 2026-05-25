export type PaymentRegion = "IN" | "INTL";

/** Minimum price: $2.99 USD with 18% GST included. */
export const PAYMENT_BASE_USD = Number(process.env.PAYMENT_BASE_USD || "2.99");
export const GST_RATE_PERCENT = 18;
export const USD_TO_INR_RATE = Number(process.env.USD_TO_INR_RATE || "80.84");

export type PaymentQuote = {
  region: PaymentRegion;
  currency: "INR" | "USD";
  total: number;
  amountSubunits: number;
  gstInclusive: true;
  gstRatePercent: number;
};

export function getPaymentQuote(region: PaymentRegion): PaymentQuote {
  if (region === "INTL") {
    return {
      region,
      currency: "USD",
      total: PAYMENT_BASE_USD,
      amountSubunits: Math.round(PAYMENT_BASE_USD * 100),
      gstInclusive: true,
      gstRatePercent: GST_RATE_PERCENT,
    };
  }

  const baseInr = PAYMENT_BASE_USD * USD_TO_INR_RATE;
  const totalInr =
    Math.round(baseInr * (1 + GST_RATE_PERCENT / 100) * 100) / 100;

  return {
    region,
    currency: "INR",
    total: totalInr,
    amountSubunits: Math.round(totalInr * 100),
    gstInclusive: true,
    gstRatePercent: GST_RATE_PERCENT,
  };
}
