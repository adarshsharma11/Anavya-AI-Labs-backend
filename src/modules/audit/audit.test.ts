import { describe, expect, test } from "bun:test";
import { extractPage, detectPageType } from "./extract.js";
import { parseRobots, isCrawlerAllowed } from "./robots.js";
import { selectKeyPages, extractSitemapLocs } from "./discover.js";
import { runPageChecks } from "./checks/page.js";
import { runSiteChecks, type SiteData } from "./checks/site.js";
import { runSpeedChecks } from "./checks/speed.js";
import { buildRecommendations, overallScore, scoreCategories } from "./score.js";
import { isRealTextFile, type FetchedResource } from "./fetch.js";
import type { PageAudit } from "./types.js";

const filler = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

const RICH_ARTICLE = `<!doctype html><html lang="en"><head>
<title>How to Fix Slow Websites: A Complete 2026 Guide for Owners</title>
<meta name="description" content="${"Learn exactly how to fix a slow website with tested steps, real benchmarks, and tools that cut load time in half for small business owners.".slice(0, 150)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://example.com/blog/fix-slow-websites">
<meta property="og:title" content="Fix slow websites"><meta property="og:description" content="Guide"><meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image">
<meta property="article:modified_time" content="${new Date().toISOString()}">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"BlogPosting","headline":"Fix slow websites","author":{"@type":"Person","name":"Jane Doe"},"datePublished":"2026-01-01"},
 {"@type":"Organization","name":"Example Co","sameAs":["https://x.com/example"]},
 {"@type":"FAQPage","mainEntity":[]},{"@type":"HowTo","name":"Speed up"}]}</script>
</head><body><header><nav><a href="/about">About</a></nav></header><main>
<h1>How to fix a slow website</h1>
<p>A slow website loses customers: pages that take more than 3 seconds to load lose 53% of mobile visitors, according to Google research. This guide shows the exact steps we used to cut load time from 6.2 seconds to 1.9 seconds across 120 client sites in 2025, with tools you can use today for free and no developer required at all for most fixes.</p>
<h2>What makes a website slow?</h2><p>Large images are the cause on 70% of sites we audit, according to our 2025 study of 120 sites.</p>
<h2>How do I measure speed?</h2><p>Use PageSpeed Insights; a score above 90 is good and LCP under 2.5 seconds passes.</p>
<h2>Why does speed matter?</h2><p>Survey data shows 1 second of delay cuts conversions by 7% for online stores.</p>
<ol><li>Compress images</li><li>Defer scripts</li><li>Use a CDN</li></ol>
<details><summary>Is it free?</summary>Yes</details><details><summary>Does it work?</summary>Yes</details><details><summary>How long?</summary>A day</details>
<p>${filler(800)}</p>
<a href="https://web.dev/lcp">LCP</a><a href="https://developers.google.com">Google</a><a href="https://httparchive.org">HTTP Archive</a>
${Array.from({ length: 12 }, (_, i) => `<a href="/blog/post-${i}">Post ${i}</a>`).join("")}
<img src="a.png" alt="chart">
</main></body></html>`;

const THIN_HOME = `<html><head><title>Home</title></head><body><h1>Hi</h1><p>We build websites for you.</p></body></html>`;

const status = (checks: ReturnType<typeof runPageChecks>, id: string) => checks.find((c) => c.id === id)?.status;

describe("extractPage", () => {
  const page = extractPage("https://example.com/blog/fix-slow-websites", RICH_ARTICLE);

  test("reads head, schema and structure", () => {
    expect(page.lang).toBe("en");
    expect(page.pageType).toBe("article");
    expect(page.schemaTypes).toEqual(expect.arrayContaining(["BlogPosting", "Organization", "FAQPage", "HowTo"]));
    expect(page.author).toBe("Jane Doe");
    expect(page.h1).toEqual(["How to fix a slow website"]);
    expect(page.faqPairs).toBeGreaterThanOrEqual(3);
    expect(page.externalHosts.length).toBe(3);
    expect(page.hasAboutOrContactLink).toBe(true);
    expect(page.wordCount).toBeGreaterThan(800);
  });

  test("ignores nav and header text in the opening paragraph", () => {
    expect(page.openingParagraph.startsWith("A slow website")).toBe(true);
  });
});

describe("detectPageType", () => {
  test("classifies common paths", () => {
    expect(detectPageType("/", "", [])).toBe("homepage");
    expect(detectPageType("/en/", "", [])).toBe("homepage");
    expect(detectPageType("/blog/my-post", "", [])).toBe("article");
    expect(detectPageType("/products/shoe", "", [])).toBe("product");
    expect(detectPageType("/pricing", "", [])).toBe("page");
  });
});

describe("page checks", () => {
  test("a strong article passes the key AEO and GEO checks", () => {
    const checks = runPageChecks(extractPage("https://example.com/blog/fix-slow-websites", RICH_ARTICLE));
    for (const id of ["faq_schema", "direct_answer", "question_headings", "factual_density", "howto_schema", "author", "article_schema", "freshness", "entity_clarity", "external_citations", "title_length", "meta_description", "word_count"]) {
      expect([id, status(checks, id)]).toEqual([id, "pass"]);
    }
  });

  test("a thin homepage fails content checks and skips article-only checks", () => {
    const checks = runPageChecks(extractPage("https://example.com/", THIN_HOME));
    expect(status(checks, "word_count")).toBe("fail");
    expect(status(checks, "faq_schema")).toBe("fail");
    expect(status(checks, "author")).toBe("na");
    expect(status(checks, "freshness")).toBe("na");
    expect(status(checks, "howto_schema")).toBe("na");
    expect(checks.every((c) => c.status === "pass" || c.status === "na" || c.fix)).toBe(true);
  });

  test("each category is scored out of 100 points", () => {
    const site: SiteData = {
      origin: "https://example.com",
      robotsFound: false,
      robots: parseRobots(""),
      llmsTxt: false,
      llmsFullOrSmall: false,
      aiTxt: false,
      sitemapFound: false,
      sitemapUrls: [],
    };
    const speed = runSpeedChecks({
      source: "pagespeed",
      strategy: "mobile",
      performanceScore: 67,
      lab: { lcpMs: 8300, cls: 0, tbtMs: 100, fcpMs: 1000, speedIndexMs: 2000 },
      field: { category: "AVERAGE", lcpMs: 8300, inpMs: 60, cls: 0 },
    });
    const all = [...runSiteChecks(site), ...runPageChecks(extractPage("https://example.com/", THIN_HOME)), ...speed];
    const totals = all.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.category]: (acc[c.category] ?? 0) + c.maxPoints }), {});
    expect(totals).toEqual({ aeo: 100, geo: 100, crawlers: 100, technical: 100, content: 100, speed: 100 });
    expect(speed.find((c) => c.id === "lcp")?.points).toBe(0);
    expect(speed.find((c) => c.id === "performance_score")?.points).toBe(40);
  });
});

describe("robots", () => {
  const robots = parseRobots(`
User-agent: GPTBot
User-agent: ClaudeBot
Disallow: /

User-agent: *
Disallow: /admin
Sitemap: https://example.com/sitemap.xml`);

  test("applies grouped user-agents and falls back to *", () => {
    expect(isCrawlerAllowed(robots, "GPTBot")).toBe(false);
    expect(isCrawlerAllowed(robots, "ClaudeBot")).toBe(false);
    expect(isCrawlerAllowed(robots, "PerplexityBot")).toBe(true);
    expect(robots.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });

  test("site checks score blocked crawlers as failures", () => {
    const checks = runSiteChecks({
      origin: "https://example.com",
      robotsFound: true,
      robots,
      llmsTxt: true,
      llmsFullOrSmall: false,
      aiTxt: false,
      sitemapFound: true,
      sitemapUrls: [],
    });
    expect(scoreCategories(checks).crawlers).toBe(70);
  });
});

describe("text file detection", () => {
  const res = (body: string, contentType: string): FetchedResource => ({
    ok: true, status: 200, url: "", finalUrl: "", body, contentType, headers: {}, elapsedMs: 0,
  });
  test("rejects SPA HTML shells served for missing files", () => {
    expect(isRealTextFile(res("<!DOCTYPE html><html></html>", "text/html"))).toBe(false);
    expect(isRealTextFile(res("# Example\n> About us", "text/plain"))).toBe(true);
  });
});

describe("page discovery", () => {
  test("reads sitemap locs and prefers key page types", () => {
    const locs = extractSitemapLocs(`<urlset>
      <url><loc>https://example.com/</loc></url>
      <url><loc>https://example.com/tag/seo</loc></url>
      <url><loc>https://example.com/blog/post-a</loc></url>
      <url><loc>https://example.com/services</loc></url>
      <url><loc>https://other.com/x</loc></url>
      <url><loc><![CDATA[https://example.com/pricing]]></loc></url>
      <url><loc>https://example.com/image.png</loc></url>
    </urlset>`);
    const picked = selectKeyPages("https://example.com/", locs, 5);
    expect(picked).toEqual([
      "https://example.com/services",
      "https://example.com/pricing",
      "https://example.com/blog/post-a",
    ]);
  });
});

describe("scoring", () => {
  test("weights the homepage at 40% when ranking recommendations", () => {
    const checks = runPageChecks(extractPage("https://example.com/", THIN_HOME));
    const categories = scoreCategories(checks);
    const page = (url: string, isHomepage: boolean): PageAudit => ({
      url, title: "", pageType: isHomepage ? "homepage" : "page", isHomepage,
      overall: overallScore(categories), categories, checks, speed: null,
      stats: { wordCount: 5, sizeKB: 1, internalLinks: 0, externalLinks: 0, images: 0, schemaTypes: [] },
    });
    const recs = buildRecommendations([], [page("https://example.com/", true), page("https://example.com/a", false)]);
    const wordCount = recs.find((r) => r.id === "word_count");
    expect(wordCount?.gain).toBe(20);
    expect(wordCount?.priority).toBe("critical");
    expect(wordCount?.affectedPages.length).toBe(2);
    expect(recs[0]!.gain).toBeGreaterThanOrEqual(recs[recs.length - 1]!.gain);
  });
});
