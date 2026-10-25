import { describe, expect, test } from "bun:test";
import { priceForRegion } from "./paymentConfig.js";

describe("priceForRegion", () => {
  test("international customers pay the USD list price with no GST", () => {
    expect(priceForRegion(9, "INTL", 84)).toEqual({
      region: "INTL",
      currency: "USD",
      base: 9,
      gstAmount: 0,
      gstRatePercent: 0,
      total: 9,
      amountSubunits: 900,
    });
  });

  test("Indian customers pay whole rupees at the live rate plus 18% GST", () => {
    const quote = priceForRegion(29, "IN", 84.37);
    expect(quote.currency).toBe("INR");
    expect(quote.base).toBe(2447);
    expect(quote.gstAmount).toBe(440);
    expect(quote.total).toBe(2887);
    expect(quote.amountSubunits).toBe(288700);
    expect(quote.usdToInrRate).toBe(84.37);
  });

  test("GST is always 18% of the base and the total is base plus GST", () => {
    for (const usd of [9, 29]) {
      for (const rate of [80.5, 83.21, 88]) {
        const q = priceForRegion(usd, "IN", rate);
        expect(q.total).toBe(q.base + q.gstAmount);
        expect(Math.abs(q.gstAmount - q.base * 0.18)).toBeLessThanOrEqual(0.5);
        expect(Number.isInteger(q.total)).toBe(true);
      }
    }
  });
});
