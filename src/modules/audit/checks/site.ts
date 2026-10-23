import type { CheckResult } from "../types.js";
import { AI_CRAWLERS, isCrawlerAllowed, type ParsedRobots } from "../robots.js";
import { passFail, type CheckDef } from "./define.js";

export interface SiteData {
  readonly origin: string;
  readonly robotsFound: boolean;
  readonly robots: ParsedRobots;
  readonly llmsTxt: boolean;
  readonly llmsFullOrSmall: boolean;
  readonly aiTxt: boolean;
  readonly sitemapFound: boolean;
  readonly sitemapUrls: readonly string[];
}

const crawlerChecks = (site: SiteData): CheckResult[] =>
  AI_CRAWLERS.map((bot) => {
    const def: CheckDef = {
      id: `crawler_${bot.agent.toLowerCase()}`,
      category: "crawlers",
      label: `${bot.agent} (${bot.owner})`,
      maxPoints: bot.points,
      why: `${bot.owner} uses ${bot.agent} to read pages it can quote in AI answers. Blocking it removes you from those answers.`,
    };
    const allowed = isCrawlerAllowed(site.robots, bot.agent);
    const evidence = !site.robotsFound
      ? "No robots.txt, so it is allowed by default"
      : allowed
        ? "Allowed in robots.txt"
        : "Blocked in robots.txt";
    return passFail(
      def,
      allowed,
      evidence,
      `In robots.txt, remove the "Disallow: /" rule for ${bot.agent} (or add "User-agent: ${bot.agent}" followed by "Allow: /").`,
    );
  });

export function runSiteChecks(site: SiteData): CheckResult[] {
  return [
    ...crawlerChecks(site),
    passFail(
      {
        id: "llms_txt",
        category: "geo",
        label: "llms.txt File Presence",
        maxPoints: 20,
        why: "llms.txt gives AI assistants a clean summary of your site and your most important pages.",
      },
      site.llmsTxt,
      site.llmsTxt ? "llms.txt was found and readable" : "No llms.txt found",
      `Create ${site.origin}/llms.txt: a short markdown file with your company name, a 2-line description, and links to your 5–10 most important pages.`,
    ),
    passFail(
      {
        id: "llms_full_txt",
        category: "geo",
        label: "llms-full.txt or llms-small.txt",
        maxPoints: 7,
        why: "A full-text version lets AI tools load your key content in one request instead of crawling many pages.",
      },
      site.llmsFullOrSmall,
      site.llmsFullOrSmall ? "llms-full.txt or llms-small.txt found" : "No llms-full.txt or llms-small.txt found",
      `Publish ${site.origin}/llms-full.txt containing the plain-text content of your main pages (services, pricing, FAQ).`,
    ),
    passFail(
      {
        id: "ai_txt",
        category: "geo",
        label: ".well-known/ai.txt",
        maxPoints: 6,
        why: "ai.txt states how AI systems may use your content, which signals a site that is ready for AI use.",
      },
      site.aiTxt,
      site.aiTxt ? "ai.txt found" : "No ai.txt file found",
      `Add ${site.origin}/.well-known/ai.txt with lines such as "User-Agent: *" and "Allow: /" to state your AI usage policy.`,
    ),
    passFail(
      {
        id: "sitemap",
        category: "technical",
        label: "XML Sitemap",
        maxPoints: 5,
        why: "A sitemap helps search engines and AI crawlers find every page you want indexed.",
      },
      site.sitemapFound,
      site.sitemapFound ? `Sitemap found with ${site.sitemapUrls.length} URLs` : "No sitemap.xml found",
      `Generate ${site.origin}/sitemap.xml listing all public pages, and add "Sitemap: ${site.origin}/sitemap.xml" to robots.txt.`,
    ),
  ];
}
