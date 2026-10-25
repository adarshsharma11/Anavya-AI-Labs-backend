import { fetchPageSpeed, type PageSpeedResult } from "../../lib/pagespeed.js";
import { getOrigin } from "../../lib/safeUrl.js";
import { logError } from "../../lib/errorLog.js";
import { fetchResource, isHtml, isRealTextFile } from "./fetch.js";
import { extractPage, type PageData } from "./extract.js";
import { parseRobots } from "./robots.js";
import { loadSitemapUrls, selectKeyPages } from "./discover.js";
import { runSiteChecks, type SiteData } from "./checks/site.js";
import { runPageChecks } from "./checks/page.js";
import { runBasicSpeedChecks, runSpeedChecks } from "./checks/speed.js";
import {
  buildRecommendations,
  buildSummary,
  overallScore,
  pageWeights,
  scoreCategories,
  siteCategories,
  verdictFor,
} from "./score.js";
import { AI_CRAWLERS } from "./robots.js";
import type { AuditReport, CheckResult, PageAudit, StageStatus } from "./types.js";

export class AuditError extends Error {}

export interface AuditOptions {
  readonly multiPage: boolean;
  readonly speed: boolean;
}

export interface AuditRun {
  readonly initial: AuditReport;
  readonly completion: Promise<AuditReport>;
}

interface PageState {
  readonly data: PageData;
  speed: PageSpeedResult | null;
  readonly responseMs: number | null;
}

const PAGE_FETCH_CONCURRENCY = 3;

const mapLimit = async <T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>) => {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

const speedChecksFor = (state: PageState) => {
  if (state.speed) return runSpeedChecks(state.speed);
  if (state.responseMs !== null) return runBasicSpeedChecks(state.data, state.responseMs);
  return [];
};

const buildPageAudit = (state: PageState, siteChecks: readonly CheckResult[]): PageAudit => {
  const checks = [...runPageChecks(state.data), ...speedChecksFor(state)];
  const categories = scoreCategories([...siteChecks, ...checks]);
  return {
    url: state.data.url,
    title: state.data.title,
    pageType: state.data.pageType,
    isHomepage: state.data.pageType === "homepage",
    overall: overallScore(categories),
    categories,
    checks,
    speed: state.speed,
    stats: {
      wordCount: state.data.wordCount,
      sizeKB: state.data.sizeKB,
      internalLinks: state.data.internalLinks.length,
      externalLinks: state.data.externalHosts.length,
      images: state.data.images,
      schemaTypes: state.data.schemaTypes,
    },
  };
};

const assemble = (
  url: string,
  origin: string,
  siteChecks: readonly CheckResult[],
  states: readonly PageState[],
  progress: { pages: StageStatus; speed: StageStatus },
): AuditReport => {
  const pages = states.map((s) => buildPageAudit(s, siteChecks));
  const categories = siteCategories(pages);
  const overall = overallScore(categories);
  const recommendations = buildRecommendations(siteChecks, pages);
  const crawlerChecks = siteChecks.filter((c) => c.category === "crawlers");
  const allowed = crawlerChecks.filter((c) => c.status === "pass").length;
  const structuredDataTypes = [...new Set(pages.flatMap((p) => p.stats.schemaTypes))];
  const weights = pageWeights(pages);
  const avgWords = Math.round(pages.reduce((sum, p, i) => sum + p.stats.wordCount * weights[i]!, 0));

  return {
    version: 2,
    url,
    origin,
    generatedAt: new Date().toISOString(),
    complete: progress.pages !== "running" && progress.speed !== "running",
    progress,
    speedSource: states.some((s) => s.speed) ? "pagespeed" : states.some((s) => s.responseMs !== null) ? "basic" : null,
    overall,
    verdict: verdictFor(overall),
    summary: buildSummary({
      overall,
      pageCount: pages.length,
      schemaTypes: structuredDataTypes,
      crawlersAllowed: allowed,
      crawlersTotal: AI_CRAWLERS.length,
      avgWords,
      recommendations,
    }),
    totalIssuesFound: recommendations.length,
    categories,
    crawlerAccess: { allowed, total: AI_CRAWLERS.length },
    structuredDataTypes,
    siteChecks,
    pages,
    recommendations,
  };
};

const loadPage = async (url: string): Promise<PageData | null> => {
  const res = await fetchResource(url);
  return isHtml(res) ? extractPage(res.finalUrl, res.body) : null;
};

export async function startSiteAudit(
  url: string,
  options: AuditOptions,
  onProgress?: (report: AuditReport) => Promise<void>,
): Promise<AuditRun> {
  const origin = getOrigin(url);
  const homeSpeed = options.speed ? fetchPageSpeed(url) : Promise.resolve(null);

  const [pageRes, robotsRes, llms, llmsFull, llmsSmall, aiWellKnown, aiRoot] = await Promise.all([
    fetchResource(url, 12000),
    fetchResource(`${origin}/robots.txt`, 6000),
    fetchResource(`${origin}/llms.txt`, 6000),
    fetchResource(`${origin}/llms-full.txt`, 6000),
    fetchResource(`${origin}/llms-small.txt`, 6000),
    fetchResource(`${origin}/.well-known/ai.txt`, 6000),
    fetchResource(`${origin}/ai.txt`, 6000),
  ]);

  if (!isHtml(pageRes)) {
    throw new AuditError(
      pageRes.status
        ? `We couldn't read that page (HTTP ${pageRes.status}). Check the URL is public and try again.`
        : "We couldn't reach that website. Check the URL and try again.",
    );
  }

  const robotsFound = isRealTextFile(robotsRes);
  const robots = parseRobots(robotsFound ? robotsRes.body : "");
  const sitemap = await loadSitemapUrls([
    ...robots.sitemaps,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
  ]);

  const site: SiteData = {
    origin,
    robotsFound,
    robots,
    llmsTxt: isRealTextFile(llms),
    llmsFullOrSmall: isRealTextFile(llmsFull) || isRealTextFile(llmsSmall),
    aiTxt: isRealTextFile(aiWellKnown) || isRealTextFile(aiRoot),
    sitemapFound: sitemap.found,
    sitemapUrls: sitemap.urls,
  };
  const siteChecks = runSiteChecks(site);

  const home: PageState = {
    data: extractPage(pageRes.finalUrl, pageRes.body),
    speed: null,
    responseMs: options.speed ? pageRes.elapsedMs : null,
  };
  const states: PageState[] = [home];
  const progress: { pages: StageStatus; speed: StageStatus } = {
    pages: options.multiPage ? "running" : "done",
    speed: options.speed ? "running" : "unavailable",
  };
  const snapshot = () => assemble(url, origin, siteChecks, states, { ...progress });

  let saveChain = Promise.resolve();
  const emit = () => {
    if (!onProgress) return saveChain;
    const report = snapshot();
    saveChain = saveChain.then(() => onProgress(report)).catch((err) => logError("AUDIT_PROGRESS", err, { url }));
    return saveChain;
  };

  const runPages = async () => {
    if (!options.multiPage) return [] as PageState[];
    const candidates = sitemap.urls.length ? sitemap.urls : home.data.internalLinks;
    const extraUrls = selectKeyPages(home.data.url, candidates);
    const loaded = await mapLimit(extraUrls, PAGE_FETCH_CONCURRENCY, loadPage);
    const extra = loaded.filter((p): p is PageData => p !== null).map((data) => ({ data, speed: null, responseMs: null }));
    states.push(...extra);
    progress.pages = "done";
    await emit();
    return extra;
  };

  const runSpeed = async (pagesPromise: Promise<PageState[]>) => {
    if (!options.speed) return;
    const extra = await pagesPromise;
    const second = extra[0];
    const [homeResult, secondResult] = await Promise.all([
      homeSpeed,
      second ? fetchPageSpeed(second.data.url) : Promise.resolve(null),
    ]);
    home.speed = homeResult;
    if (second) second.speed = secondResult;
    progress.speed = "done";
    await emit();
  };

  const completion = (async () => {
    const pagesPromise = runPages().catch((err) => {
      logError("AUDIT_PAGES", err, { url });
      progress.pages = "done";
      return [] as PageState[];
    });
    await Promise.all([
      pagesPromise,
      runSpeed(pagesPromise).catch((err) => {
        logError("AUDIT_SPEED", err, { url });
        progress.speed = "done";
      }),
    ]);
    await saveChain;
    return snapshot();
  })();

  return { initial: snapshot(), completion };
}

export const isAuditComplete = (preview: unknown) => {
  if (!preview || typeof preview !== "object") return false;
  const report = preview as { version?: number; complete?: boolean };
  return report.version !== 2 || report.complete === true;
};

/** Compact view of the audit for the AI prompt, so tokens go to findings rather than raw check lists. */
export function summarizeAuditForAi(report: AuditReport) {
  return {
    url: report.url,
    overall: report.overall,
    verdict: report.verdict,
    categories: report.categories,
    crawlerAccess: report.crawlerAccess,
    structuredDataTypes: report.structuredDataTypes,
    pages: report.pages.map((p) => ({
      url: p.url,
      pageType: p.pageType,
      overall: p.overall,
      wordCount: p.stats.wordCount,
      speed: p.speed
        ? { performanceScore: p.speed.performanceScore, lcpMs: p.speed.field?.lcpMs ?? p.speed.lab.lcpMs, inpMs: p.speed.field?.inpMs ?? null }
        : null,
    })),
    topIssues: report.recommendations.slice(0, 15).map((r) => ({
      issue: r.label,
      priority: r.priority,
      gain: r.gain,
      evidence: r.evidence,
      pagesAffected: r.affectedPages.length,
    })),
  };
}
