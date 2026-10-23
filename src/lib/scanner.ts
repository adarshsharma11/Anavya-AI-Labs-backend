import axios from "axios";
import * as cheerio from "cheerio";
import { fetchPageSpeed, type PageSpeedResult } from "./pagespeed.js";
import { getOrigin, safeRedirects } from "./safeUrl.js";

export const FREE_PREVIEW_ITEMS = 4;

type Issue = { title: string; severity: "High" | "Medium" | "Low" };

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const fetchText = async (url: string) => {
  const res = await axios.get(url, { ...safeRedirects, timeout: 8000, headers: BROWSER_HEADERS });
  return typeof res.data === "string" ? res.data : "";
};

const responseTimeScore = (loadTime: number, sizeKB: number, scripts: number) => {
  let score = 45;
  if (loadTime < 1200) score = 95;
  else if (loadTime < 2500) score = 85;
  else if (loadTime < 4000) score = 72;
  else if (loadTime < 6000) score = 60;

  if (sizeKB > 2000) score -= 8;
  if (scripts > 80) score -= 6;
  return Math.max(score, 40);
};

const addCoreWebVitalIssues = (psi: PageSpeedResult, issues: Issue[], quickWins: string[]) => {
  const lcp = psi.field?.lcpMs ?? psi.lab.lcpMs;
  const cls = psi.field?.cls ?? psi.lab.cls;
  const inp = psi.field?.inpMs ?? null;
  const tbt = psi.lab.tbtMs;

  if (lcp !== null && lcp > 2500) {
    issues.push({ title: `Largest Contentful Paint is ${(lcp / 1000).toFixed(1)}s (target 2.5s)`, severity: lcp > 4000 ? "High" : "Medium" });
    quickWins.push("Preload the hero image and serve it as WebP or AVIF to cut LCP");
  }
  if (cls !== null && cls > 0.1) {
    issues.push({ title: `Layout shift score is ${cls.toFixed(2)} (target 0.1)`, severity: cls > 0.25 ? "High" : "Medium" });
    quickWins.push("Set width and height on images and reserve space for banners to stop layout shift");
  }
  if (inp !== null && inp > 200) {
    issues.push({ title: `Interaction to Next Paint is ${inp}ms (target 200ms)`, severity: inp > 500 ? "High" : "Medium" });
    quickWins.push("Move third-party scripts off click handlers to improve INP");
  } else if (tbt !== null && tbt > 200) {
    issues.push({ title: `Total Blocking Time is ${Math.round(tbt)}ms (target 200ms)`, severity: tbt > 600 ? "High" : "Medium" });
    quickWins.push("Split long JavaScript tasks and defer non-critical scripts");
  }
};

export const runWebsiteScan = async (url: string) => {
  try {
    const origin = getOrigin(url);
    const pageSpeedPromise = fetchPageSpeed(url);
    const start = Date.now();

    const res = await axios.get(url, {
      ...safeRedirects,
      timeout: 20000,
      headers: { ...BROWSER_HEADERS, Connection: "keep-alive" },
    });

    const loadTime = Date.now() - start;
    const html = typeof res.data === "string" ? res.data : "";
    const sizeKB = Math.round(Buffer.byteLength(html) / 1024);

    const $ = cheerio.load(html);

    const title = $("title").text().trim();
    const metaDesc = $('meta[name="description"]').attr("content");
    const h1Count = $("h1").length;
    const canonical = $('link[rel="canonical"]').attr("href");
    const metaRobots = $('meta[name="robots"]').attr("content") || "N/A";
    const favicon = $('link[rel*="icon"]').attr("href");

    const titleChars = title.length;
    const metaDescriptionChars = metaDesc ? metaDesc.length : undefined;
    const metaDescriptionWords = metaDesc ? metaDesc.trim().split(/\s+/).filter(Boolean).length : undefined;

    const ogTitle = $('meta[property="og:title"]').attr("content");
    const ogDesc = $('meta[property="og:description"]').attr("content");
    const ogImage = $('meta[property="og:image"]').attr("content");
    const twitterCard = $('meta[name="twitter:card"]').attr("content");
    const viewport = $('meta[name="viewport"]').attr("content");

    const totalImages = $("img").length;
    let imagesWithoutAlt = 0;
    $("img").each((_, el) => {
      if (!$(el).attr("alt")) imagesWithoutAlt++;
    });

    const scripts = $("script").length;
    const links = $("a").length;
    const https = url.startsWith("https");

    const [robotsText, sitemapText, pageSpeed] = await Promise.all([
      fetchText(`${origin}/robots.txt`).catch(() => ""),
      fetchText(`${origin}/sitemap.xml`).catch(() => ""),
      pageSpeedPromise,
    ]);
    const robotsOk = /user-agent/i.test(robotsText);
    const sitemapOk = /<(urlset|sitemapindex)/i.test(sitemapText);

    const perfScore = pageSpeed?.performanceScore ?? responseTimeScore(loadTime, sizeKB, scripts);

    let seoScore = 0;
    if (title) seoScore += 15;
    if (metaDesc) seoScore += 18;
    if (canonical) seoScore += 10;
    if (h1Count > 0) seoScore += 10;
    if (ogTitle) seoScore += 6;
    if (ogDesc) seoScore += 6;
    if (ogImage) seoScore += 8;
    if (twitterCard) seoScore += 6;
    if (robotsOk) seoScore += 8;
    if (sitemapOk) seoScore += 7;
    seoScore = Math.min(seoScore, 96);

    let accessibility = 92;
    if (imagesWithoutAlt > 0) accessibility -= Math.min(imagesWithoutAlt * 2, 30);
    if (!viewport) accessibility -= 15;
    if (h1Count === 0) accessibility -= 10;
    accessibility = Math.max(accessibility, 45);

    const security = https ? 92 : 55;

    const overall = Math.floor(
      perfScore * 0.32 + seoScore * 0.38 + accessibility * 0.18 + security * 0.12,
    );

    let verdict = "Poor";
    if (overall >= 90) verdict = "Excellent";
    else if (overall >= 75) verdict = "Good";
    else if (overall >= 60) verdict = "Needs Improvement";

    const issues: Issue[] = [];
    const quickWins: string[] = [];

    if (!title) {
      issues.push({ title: "Missing title tag", severity: "High" });
      quickWins.push("Add SEO optimized title with keywords");
    }
    if (!metaDesc) {
      issues.push({ title: "Missing meta description", severity: "High" });
      quickWins.push("Add meta description to improve Google CTR");
    }
    if (!canonical) {
      issues.push({ title: "Missing canonical tag", severity: "Medium" });
      quickWins.push("Add canonical tag to avoid duplicate SEO issues");
    }
    if (!ogTitle || !ogDesc) {
      issues.push({ title: "OpenGraph tags missing", severity: "Medium" });
      quickWins.push("Add OpenGraph tags for social sharing");
    }
    if (!ogImage) {
      issues.push({ title: "OG image missing", severity: "Medium" });
      quickWins.push("Add og:image for better link preview & CTR");
    }
    if (!twitterCard) {
      issues.push({ title: "Twitter meta tags missing", severity: "Low" });
      quickWins.push("Add Twitter card meta tags");
    }
    if (!robotsOk) {
      issues.push({ title: "robots.txt missing", severity: "High" });
      quickWins.push("Add robots.txt for search indexing");
    }
    if (!sitemapOk) {
      issues.push({ title: "sitemap.xml missing", severity: "Medium" });
      quickWins.push("Add sitemap.xml for SEO indexing");
    }
    if (imagesWithoutAlt > 0) {
      issues.push({ title: `${imagesWithoutAlt} images missing alt text`, severity: "Medium" });
      quickWins.push(`Add alt text to ${imagesWithoutAlt} images`);
    }
    if (pageSpeed) {
      addCoreWebVitalIssues(pageSpeed, issues, quickWins);
    } else if (loadTime > 3000) {
      issues.push({ title: "Slow website speed", severity: "High" });
      quickWins.push(`Improve load speed (${loadTime}ms → under 1500ms)`);
    }
    if (!viewport) {
      issues.push({ title: "Viewport meta missing", severity: "Medium" });
      quickWins.push("Add viewport meta for mobile responsiveness");
    }
    if (!https) {
      issues.push({ title: "Site not using HTTPS", severity: "High" });
      quickWins.push("Enable SSL certificate (HTTPS)");
    }

    const totalIssuesFound = issues.length;
    const potentialScore = Math.min(overall + Math.min(totalIssuesFound * 2.5, 25), 96);

    let trafficPotential = "Minor growth potential (10-20%)";
    if (seoScore < 50) trafficPotential = "High growth potential (40-70%)";
    else if (seoScore < 70) trafficPotential = "Medium growth potential (20-40%)";

    return {
      overall,
      verdict,
      totalIssuesFound,

      categories: {
        performance: perfScore,
        seo: seoScore,
        accessibility,
        security,
      },

      metrics: {
        loadTime: loadTime + "ms",
        pageSize: sizeKB + "KB",
        images: totalImages,
        scripts,
        links,
        titleChars,
        metaDescriptionChars,
        metaDescriptionWords,
        performanceSource: pageSpeed ? "pagespeed" : "response_time",
        coreWebVitals: pageSpeed,
      },

      seoMeta: {
        canonical: !!canonical,
        metaRobots,
        favicon: !!favicon,
      },

      social: {
        ogTags: !!ogTitle,
        ogImage: !!ogImage,
        twitterTags: !!twitterCard,
      },

      indexing: {
        robots: robotsOk,
        sitemap: sitemapOk,
      },

      improvements: {
        potentialScore,
        trafficPotential,
        fixCount: totalIssuesFound,
      },

      topIssues: issues.slice(0, FREE_PREVIEW_ITEMS),
      quickWins: quickWins.slice(0, FREE_PREVIEW_ITEMS),
      allIssues: issues,
      allQuickWins: quickWins,

      lockedIssues: Math.max(totalIssuesFound - FREE_PREVIEW_ITEMS, 0),
      locked: true,
    };
  } catch (e) {
    return {
      overall: 52,
      verdict: "Error",
      totalIssuesFound: 0,
      categories: {
        performance: 50,
        seo: 50,
        accessibility: 50,
        security: 50,
      },
      metrics: {
        loadTime: "0ms",
        pageSize: "0KB",
        images: 0,
        scripts: 0,
        links: 0,
        titleChars: undefined,
        metaDescriptionChars: undefined,
        metaDescriptionWords: undefined,
        performanceSource: "response_time",
        coreWebVitals: null,
      },
      seoMeta: {
        canonical: false,
        metaRobots: "N/A",
        favicon: false,
      },
      social: {
        ogTags: false,
        ogImage: false,
        twitterTags: false,
      },
      indexing: {
        robots: false,
        sitemap: false,
      },
      topIssues: [{ title: "Could not scan website", severity: "Low" }],
      quickWins: ["Try again later"],
      allIssues: [{ title: "Could not scan website", severity: "Low" }],
      allQuickWins: ["Try again later"],
      lockedIssues: 0,
      locked: true,
    };
  }
};
