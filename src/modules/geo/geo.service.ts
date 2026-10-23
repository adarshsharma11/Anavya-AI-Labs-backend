import axios from "axios";
import * as cheerio from "cheerio";

import { checkRobots } from "./services/robotsCheck.js";
import { checkLlmsTxt } from "./services/llmsTxtCheck.js";
import { checkSitemap } from "./services/sitemapCheck.js";
import { checkSchema } from "./services/schemaCheck.js";
import { checkContentStructure } from "./services/contentStructure.js";
import { checkReadability } from "./services/readabilityCheck.js";
import { checkMetadata } from "./services/metadataCheck.js";
import { checkTechnical } from "./services/technicalCheck.js";
import { calculateGeoScore, type GeoScoringResult } from "./utils/scoring.js";
import { getOrigin, safeRedirects } from "../../lib/safeUrl.js";

export type GeoAnalysis = GeoScoringResult & { url: string };

export const FREE_GEO_RECOMMENDATIONS = 3;

const withTimeout = async <T>(promise: Promise<T>, fallback: T, timeoutMs = 7500): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchHtml = async (url: string) => {
  const response = await axios.get(url, {
    ...safeRedirects,
    timeout: 7000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  return {
    html: typeof response.data === "string" ? response.data : "",
    headers: response.headers as Record<string, any>,
  };
};

export async function runGeoAnalysis(url: string): Promise<GeoAnalysis> {
  const baseUrl = getOrigin(url);

  const [pageResult, robotsRes, llmsTxtRes, sitemapRes] = await Promise.all([
    withTimeout(fetchHtml(url), { html: "", headers: {} as Record<string, any> }),
    withTimeout(checkRobots(baseUrl), { allowedBots: [], blockedBots: [], missing: true }),
    withTimeout(checkLlmsTxt(baseUrl), { present: false, status: 404 }),
    withTimeout(checkSitemap(baseUrl), { present: false, valid: false }),
  ]);

  const $ = cheerio.load(pageResult.html);
  const xRobotsHeader = pageResult.headers["x-robots-tag"] || undefined;

  const report = calculateGeoScore(
    robotsRes,
    llmsTxtRes,
    sitemapRes,
    checkSchema($),
    checkContentStructure($),
    checkReadability($),
    checkMetadata($),
    checkTechnical($, xRobotsHeader),
  );

  return { url, ...report };
}

export function lockGeoAnalysis(geo: GeoAnalysis | null | undefined) {
  if (!geo) return geo ?? null;
  const { recommendations, ...rest } = geo;
  return {
    ...rest,
    recommendations: recommendations.slice(0, FREE_GEO_RECOMMENDATIONS),
    lockedRecommendations: Math.max(recommendations.length - FREE_GEO_RECOMMENDATIONS, 0),
  };
}
