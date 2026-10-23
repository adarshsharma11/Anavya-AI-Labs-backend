import type { PageSpeedResult } from "../../lib/pagespeed.js";

export const CATEGORY_IDS = ["aeo", "geo", "crawlers", "technical", "content", "speed"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const CATEGORY_LABELS: Readonly<Record<CategoryId, string>> = {
  aeo: "AEO — Answer Engine Optimization",
  geo: "GEO — Generative Engine Optimization",
  crawlers: "AI Crawler Access",
  technical: "Technical SEO",
  content: "Content Quality",
  speed: "Page Speed",
};

export const CATEGORY_WEIGHTS: Readonly<Record<CategoryId, number>> = {
  aeo: 0.2,
  geo: 0.2,
  crawlers: 0.15,
  technical: 0.2,
  content: 0.15,
  speed: 0.1,
};

export type CheckStatus = "pass" | "partial" | "fail" | "na";
export type Priority = "critical" | "important" | "minor";
export type PageType = "homepage" | "article" | "product" | "page";

export interface CheckResult {
  readonly id: string;
  readonly category: CategoryId;
  readonly label: string;
  readonly status: CheckStatus;
  readonly points: number;
  readonly maxPoints: number;
  readonly evidence: string;
  readonly why: string;
  readonly fix: string | null;
}

export type CategoryScores = Readonly<Record<CategoryId, number | null>>;

export interface PageStats {
  readonly wordCount: number;
  readonly sizeKB: number;
  readonly internalLinks: number;
  readonly externalLinks: number;
  readonly images: number;
  readonly schemaTypes: readonly string[];
}

export interface PageAudit {
  readonly url: string;
  readonly title: string;
  readonly pageType: PageType;
  readonly isHomepage: boolean;
  readonly overall: number;
  readonly categories: CategoryScores;
  readonly checks: readonly CheckResult[];
  readonly speed: PageSpeedResult | null;
  readonly stats: PageStats;
}

export interface Recommendation {
  readonly id: string;
  readonly category: CategoryId;
  readonly label: string;
  readonly priority: Priority;
  readonly gain: number;
  readonly evidence: string;
  readonly fix: string;
  readonly why: string;
  readonly affectedPages: readonly string[];
}

export type StageStatus = "running" | "done" | "unavailable";

export interface AuditReport {
  readonly version: 2;
  readonly url: string;
  readonly origin: string;
  readonly generatedAt: string;
  readonly complete: boolean;
  readonly progress: { readonly pages: StageStatus; readonly speed: StageStatus };
  readonly overall: number;
  readonly verdict: string;
  readonly summary: string;
  readonly totalIssuesFound: number;
  readonly categories: CategoryScores;
  readonly crawlerAccess: { readonly allowed: number; readonly total: number };
  readonly structuredDataTypes: readonly string[];
  readonly siteChecks: readonly CheckResult[];
  readonly pages: readonly PageAudit[];
  readonly recommendations: readonly Recommendation[];
}
