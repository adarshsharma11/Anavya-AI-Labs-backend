import axios from "axios";
import { safeRedirects } from "../../../lib/safeUrl.js";

export interface SitemapResult {
  present: boolean;
  valid: boolean;
}

export async function checkSitemap(baseUrl: string): Promise<SitemapResult> {
  const sitemapUrl = `${baseUrl.replace(/\/$/, "")}/sitemap.xml`;

  try {
    const response = await axios.get(sitemapUrl, {
      ...safeRedirects,
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      }
    });

    const content = response.data;
    const isXml = typeof content === "string" && (content.includes("<sitemapindex") || content.includes("<urlset"));

    return {
      present: response.status === 200,
      valid: response.status === 200 && isXml
    };
  } catch {
    return {
      present: false,
      valid: false
    };
  }
}
