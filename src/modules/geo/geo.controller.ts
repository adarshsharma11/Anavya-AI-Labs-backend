import type { Context } from "hono";
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
import { calculateGeoScore } from "./utils/scoring.js";

export const runGeoCheck = async (c: Context) => {
  try {
    const body = await c.req.json();
    let { url } = body;

    if (!url) {
      return c.json({ success: false, message: "URL required" }, 400);
    }

    // URL normalization
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return c.json({ success: false, message: "Invalid URL format" }, 400);
    }

    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    // Helper function to handle individual promises with an 8-second absolute timeout wrapper
    const withTimeout = async <T>(promise: Promise<T>, defaultValue: T, timeoutMs: number = 7500): Promise<T> => {
      let timeoutId: any;
      const timeoutPromise = new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => {
          resolve(defaultValue);
        }, timeoutMs);
      });

      try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId);
        return result;
      } catch {
        clearTimeout(timeoutId);
        return defaultValue;
      }
    };

    // 1. Fetch main page HTML
    const fetchHtml = async (): Promise<{ html: string; headers: any }> => {
      const response = await axios.get(url, {
        timeout: 7000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });
      return {
        html: typeof response.data === "string" ? response.data : "",
        headers: response.headers
      };
    };

    const pageResult = await withTimeout(fetchHtml(), { html: "", headers: {} });

    // 2. Perform external resource checks concurrently
    const [robotsRes, llmsTxtRes, sitemapRes] = await Promise.all([
      withTimeout(checkRobots(baseUrl), { allowedBots: [], blockedBots: [], missing: true }),
      withTimeout(checkLlmsTxt(baseUrl), { present: false, status: 404 }),
      withTimeout(checkSitemap(baseUrl), { present: false, valid: false })
    ]);

    // 3. Parse HTML and run content/technical services
    const $ = cheerio.load(pageResult.html);
    const xRobotsHeader = pageResult.headers["x-robots-tag"] || undefined;

    const schemaRes = checkSchema($);
    const contentStrRes = checkContentStructure($);
    const readabilityRes = checkReadability($);
    const metaCheckRes = checkMetadata($);
    const technicalRes = checkTechnical($, xRobotsHeader);

    // 4. Calculate Scores and Recommendations
    const finalReport = calculateGeoScore(
      robotsRes,
      llmsTxtRes,
      sitemapRes,
      schemaRes,
      contentStrRes,
      readabilityRes,
      metaCheckRes,
      technicalRes
    );

    return c.json({
      url,
      score: finalReport.score,
      categories: finalReport.categories,
      checks: finalReport.checks,
      recommendations: finalReport.recommendations
    });

  } catch (error: any) {
    return c.json({
      success: false,
      message: error.message || "Failed to execute GEO analysis."
    }, 400);
  }
};
