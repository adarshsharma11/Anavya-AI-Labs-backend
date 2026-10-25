import axios from "axios";
import { logError } from "./errorLog.js";

export type PageSpeedResult = {
  source: "pagespeed";
  strategy: "mobile";
  performanceScore: number;
  lab: {
    lcpMs: number | null;
    cls: number | null;
    tbtMs: number | null;
    fcpMs: number | null;
    speedIndexMs: number | null;
  };
  field: {
    category: string | null;
    lcpMs: number | null;
    inpMs: number | null;
    cls: number | null;
  } | null;
};

const PAGESPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const auditValue = (audits: any, id: string) => {
  const value = audits?.[id]?.numericValue;
  return typeof value === "number" ? Math.round(value * 1000) / 1000 : null;
};

const fieldPercentile = (metrics: any, id: string) => {
  const value = metrics?.[id]?.percentile;
  return typeof value === "number" ? value : null;
};

export async function fetchPageSpeed(url: string): Promise<PageSpeedResult | null> {
  try {
    const res = await axios.get(PAGESPEED_ENDPOINT, {
      timeout: 45000,
      params: {
        url,
        strategy: "mobile",
        category: "performance",
        ...(process.env.PAGESPEED_API_KEY ? { key: process.env.PAGESPEED_API_KEY } : {}),
      },
    });

    const lighthouse = res.data?.lighthouseResult;
    const score = lighthouse?.categories?.performance?.score;
    if (typeof score !== "number") return null;

    const audits = lighthouse.audits;
    const metrics = res.data?.loadingExperience?.metrics;
    const clsField = fieldPercentile(metrics, "CUMULATIVE_LAYOUT_SHIFT_SCORE");

    return {
      source: "pagespeed",
      strategy: "mobile",
      performanceScore: Math.round(score * 100),
      lab: {
        lcpMs: auditValue(audits, "largest-contentful-paint"),
        cls: auditValue(audits, "cumulative-layout-shift"),
        tbtMs: auditValue(audits, "total-blocking-time"),
        fcpMs: auditValue(audits, "first-contentful-paint"),
        speedIndexMs: auditValue(audits, "speed-index"),
      },
      field: metrics
        ? {
            category: res.data?.loadingExperience?.overall_category ?? null,
            lcpMs: fieldPercentile(metrics, "LARGEST_CONTENTFUL_PAINT_MS"),
            inpMs: fieldPercentile(metrics, "INTERACTION_TO_NEXT_PAINT"),
            cls: clsField === null ? null : clsField / 100,
          }
        : null,
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const hint =
      status === 429 && !process.env.PAGESPEED_API_KEY
        ? "Set PAGESPEED_API_KEY: Google rejects anonymous PageSpeed requests from shared server IPs"
        : undefined;
    logError("PAGESPEED", err, { url, status, hint });
    return null;
  }
}
