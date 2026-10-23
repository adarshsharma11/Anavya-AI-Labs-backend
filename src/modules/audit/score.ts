import {
  CATEGORY_IDS,
  CATEGORY_WEIGHTS,
  type CategoryScores,
  type CheckResult,
  type PageAudit,
  type Priority,
  type Recommendation,
} from "./types.js";

export const HOMEPAGE_WEIGHT = 0.4;

export const verdictFor = (score: number) =>
  score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Needs Work" : "Poor";

export function scoreCategories(checks: readonly CheckResult[]): CategoryScores {
  return Object.fromEntries(
    CATEGORY_IDS.map((id) => {
      const inCategory = checks.filter((c) => c.category === id);
      const max = inCategory.reduce((sum, c) => sum + c.maxPoints, 0);
      const earned = inCategory.reduce((sum, c) => sum + c.points, 0);
      return [id, max ? Math.round((earned / max) * 100) : null];
    }),
  ) as CategoryScores;
}

export function overallScore(categories: CategoryScores) {
  let total = 0;
  let weight = 0;
  for (const id of CATEGORY_IDS) {
    const value = categories[id];
    if (value === null) continue;
    total += value * CATEGORY_WEIGHTS[id];
    weight += CATEGORY_WEIGHTS[id];
  }
  return weight ? Math.round(total / weight) : 0;
}

export const pageWeights = (pages: readonly PageAudit[]) => {
  const others = pages.filter((p) => !p.isHomepage).length;
  const hasHome = pages.some((p) => p.isHomepage);
  return pages.map((p) => {
    if (!hasHome) return 1 / pages.length;
    if (!others) return 1;
    return p.isHomepage ? HOMEPAGE_WEIGHT : (1 - HOMEPAGE_WEIGHT) / others;
  });
};

export function siteCategories(pages: readonly PageAudit[]): CategoryScores {
  const weights = pageWeights(pages);
  return Object.fromEntries(
    CATEGORY_IDS.map((id) => {
      let total = 0;
      let weight = 0;
      pages.forEach((page, i) => {
        const value = page.categories[id];
        if (value === null) return;
        total += value * weights[i]!;
        weight += weights[i]!;
      });
      return [id, weight ? Math.round(total / weight) : null];
    }),
  ) as CategoryScores;
}

const priorityFor = (gain: number): Priority => (gain >= 15 ? "critical" : gain >= 8 ? "important" : "minor");

const toRecommendation = (check: CheckResult, gain: number, affectedPages: readonly string[]): Recommendation => ({
  id: check.id,
  category: check.category,
  label: check.label,
  priority: priorityFor(gain),
  gain: Math.round(gain),
  evidence: check.evidence,
  fix: check.fix ?? "",
  why: check.why,
  affectedPages,
});

const failing = (c: CheckResult) => c.status === "fail" || c.status === "partial";

export function buildRecommendations(
  siteChecks: readonly CheckResult[],
  pages: readonly PageAudit[],
): Recommendation[] {
  const siteIds = new Set(siteChecks.map((c) => c.id));
  const siteRecs = siteChecks
    .filter(failing)
    .map((c) => toRecommendation(c, c.maxPoints - c.points, []));

  const weights = pageWeights(pages);
  const byId = new Map<string, { check: CheckResult; weighted: number; weight: number; pages: string[] }>();
  pages.forEach((page, i) => {
    const w = weights[i]!;
    for (const check of page.checks) {
      if (siteIds.has(check.id)) continue;
      const entry = byId.get(check.id) ?? { check, weighted: 0, weight: 0, pages: [] };
      entry.weight += w;
      if (failing(check)) {
        entry.weighted += w * (check.maxPoints - check.points);
        entry.pages.push(page.url);
        if (!failing(entry.check) || page.isHomepage) entry.check = check;
      }
      byId.set(check.id, entry);
    }
  });

  const pageRecs = [...byId.values()]
    .filter((e) => e.pages.length > 0)
    .map((e) => toRecommendation(e.check, e.weighted / e.weight, e.pages));

  return [...siteRecs, ...pageRecs]
    .filter((r) => r.gain > 0)
    .sort((a, b) => b.gain - a.gain || CATEGORY_WEIGHTS[b.category] - CATEGORY_WEIGHTS[a.category]);
}

export function buildSummary(input: {
  readonly overall: number;
  readonly pageCount: number;
  readonly schemaTypes: readonly string[];
  readonly crawlersAllowed: number;
  readonly crawlersTotal: number;
  readonly avgWords: number;
  readonly recommendations: readonly Recommendation[];
}) {
  const scope = input.pageCount > 1 ? `This site (${input.pageCount} pages analysed)` : "This page";
  const crawlerLine =
    input.crawlersAllowed === input.crawlersTotal
      ? "All key AI crawlers can access your content."
      : input.crawlersAllowed >= input.crawlersTotal / 2
        ? `Most key AI crawlers can access your content (${input.crawlersAllowed} of ${input.crawlersTotal}).`
        : `Only ${input.crawlersAllowed} of ${input.crawlersTotal} key AI crawlers can access your content, so you are invisible to many AI assistants.`;
  const contentLine =
    input.avgWords < 400
      ? "Content is very thin, which significantly limits your chances of being cited."
      : input.avgWords < 800
        ? "Content depth is moderate. More detail would increase citation chances."
        : "Content depth is strong.";
  const top = input.recommendations.slice(0, 3).map((r) => r.label);

  return [
    `${scope} scored ${input.overall}/100 for AI readiness, rated ${verdictFor(input.overall)}.`,
    input.schemaTypes.length
      ? `${input.schemaTypes.length} types of structured data implemented.`
      : "No structured data found.",
    crawlerLine,
    contentLine,
    top.length ? `Top improvements: ${top.join("; ")}.` : "No major issues found.",
  ].join(" ");
}
