import { CATEGORY_IDS, CATEGORY_LABELS, type AuditReport, type CategoryId } from "./types.js";

export interface CategoryGap {
  readonly category: CategoryId;
  readonly label: string;
  readonly yours: number;
  readonly competitor: number;
  readonly gap: number;
}

export function compareAudits(site: AuditReport, competitor: AuditReport) {
  const scoreGap = competitor.overall - site.overall;
  const summary =
    scoreGap > 15
      ? "Your competitor is well ahead on AI and search readiness"
      : scoreGap > 5
        ? "Your competitor is slightly ahead"
        : scoreGap < -5
          ? "You are ahead of this competitor"
          : "You are competing closely with this competitor";

  const categoryGaps: CategoryGap[] = CATEGORY_IDS.flatMap((id) => {
    const yours = site.categories[id];
    const theirs = competitor.categories[id];
    if (yours === null || theirs === null) return [];
    return [{ category: id, label: CATEGORY_LABELS[id], yours, competitor: theirs, gap: theirs - yours }];
  }).sort((a, b) => b.gap - a.gap);

  const siteHome = site.pages[0];
  const compHome = competitor.pages[0];
  const competitorPasses = new Set(
    [...competitor.siteChecks, ...(compHome?.checks ?? [])]
      .filter((c) => c.status === "pass")
      .map((c) => c.id),
  );
  const actionItems = [...site.siteChecks, ...(siteHome?.checks ?? [])]
    .filter((c) => (c.status === "fail" || c.status === "partial") && competitorPasses.has(c.id))
    .sort((a, b) => b.maxPoints - b.points - (a.maxPoints - a.points))
    .slice(0, 8)
    .map((c) => `${c.label}: your competitor passes this. ${c.fix ?? ""}`.trim());

  return { scoreGap, summary, categoryGaps, actionItems };
}
