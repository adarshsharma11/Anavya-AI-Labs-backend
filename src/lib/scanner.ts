import axios from "axios";
import * as cheerio from "cheerio";

export const runWebsiteScan = async (url: string) => {
  try {
    const start = Date.now();

    const res = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "keep-alive",
      },
    });

    const loadTime = Date.now() - start;
    const html = res.data;
    const sizeKB = Math.round(Buffer.byteLength(html) / 1024);

    const $ = cheerio.load(html);

    // ================= BASIC SEO =================
    const title = $("title").text().trim();
    const metaDesc = $('meta[name="description"]').attr("content");
    const h1Count = $("h1").length;
    const canonical = $('link[rel="canonical"]').attr("href");

    // ================= SOCIAL =================
    const ogTitle = $('meta[property="og:title"]').attr("content");
    const ogDesc = $('meta[property="og:description"]').attr("content");
    const ogImage = $('meta[property="og:image"]').attr("content");

    const twitterCard = $('meta[name="twitter:card"]').attr("content");

    // ================= TECH =================
    const viewport = $('meta[name="viewport"]').attr("content");

    // ================= IMAGES =================
    const totalImages = $("img").length;
    let imagesWithoutAlt = 0;
    $("img").each((_, el) => {
      if (!$(el).attr("alt")) imagesWithoutAlt++;
    });

    const scripts = $("script").length;
    const links = $("a").length;

    const https = url.startsWith("https");

    // ================= ROBOTS + SITEMAP =================
    let robotsOk = false;
    let sitemapOk = false;

    try {
      const robots = await axios.get(url + "/robots.txt");
      if (robots.data.includes("User-agent")) robotsOk = true;
    } catch {}

    try {
      const sitemap = await axios.get(url + "/sitemap.xml");
      if (sitemap.data.includes("<urlset")) sitemapOk = true;
    } catch {}

    // ================= PERFORMANCE SCORE =================
    let perfScore = 45;

    if (loadTime < 1200) perfScore = 95;
    else if (loadTime < 2500) perfScore = 85;
    else if (loadTime < 4000) perfScore = 72;
    else if (loadTime < 6000) perfScore = 60;
    else perfScore = 45;

    if (sizeKB > 2000) perfScore -= 8;
    if (scripts > 80) perfScore -= 6;

    if (perfScore < 40) perfScore = 40;

    // ================= SEO SCORE =================
    let seoScore = 0;

    if (title) seoScore += 15;
    if (metaDesc) seoScore += 18;
    if (canonical) seoScore += 10;
    if (h1Count > 0) seoScore += 10;
    if (ogTitle) seoScore += 6;
    if (ogDesc) seoScore += 6;
    if (ogImage) seoScore += 8; // 🔥 OG IMAGE weight
    if (twitterCard) seoScore += 6;
    if (robotsOk) seoScore += 8;
    if (sitemapOk) seoScore += 7;

    seoScore = Math.min(seoScore, 96);

    // ================= ACCESSIBILITY =================
    let accessibility = 92;

    if (imagesWithoutAlt > 0) {
      accessibility -= Math.min(imagesWithoutAlt * 2, 30);
    }

    if (!viewport) accessibility -= 15;
    if (h1Count === 0) accessibility -= 10;

    if (accessibility < 45) accessibility = 45;

    // ================= SECURITY =================
    let security = https ? 92 : 55;

    // ================= OVERALL =================
    const overall = Math.floor(
      perfScore * 0.32 +
      seoScore * 0.38 +
      accessibility * 0.18 +
      security * 0.12
    );

    // ================= VERDICT =================
    let verdict = "Good";
    if (overall >= 90) verdict = "Excellent";
    else if (overall >= 75) verdict = "Good";
    else if (overall >= 60) verdict = "Needs Improvement";
    else verdict = "Poor";

    // ================= ISSUES =================
    const issues: any[] = [];
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
      issues.push({
        title: `${imagesWithoutAlt} images missing alt text`,
        severity: "Medium",
      });
      quickWins.push(`Add alt text to ${imagesWithoutAlt} images`);
    }

    if (loadTime > 3000) {
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

    // ================= IMPROVEMENT ESTIMATE =================
    let potentialScore = overall;
    potentialScore += Math.min(totalIssuesFound * 2.5, 25);
    if (potentialScore > 96) potentialScore = 96;

    let trafficPotential = "Low";
    if (seoScore < 50) trafficPotential = "High growth potential (40-70%)";
    else if (seoScore < 70) trafficPotential = "Medium growth potential (20-40%)";
    else trafficPotential = "Minor growth potential (10-20%)";

    // limit free preview
    const previewIssues = issues.slice(0, 4);
    const previewWins = quickWins.slice(0, 4);

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

      topIssues: previewIssues,
      quickWins: previewWins,

      lockedIssues: totalIssuesFound,
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
      locked: true,
    };
  }
};
