import type { RobotsResult } from "../services/robotsCheck";
import type { LlmsTxtResult } from "../services/llmsTxtCheck";
import type { SitemapResult } from "../services/sitemapCheck";
import type { SchemaResult } from "../services/schemaCheck";
import type { ContentStructureResult } from "../services/contentStructure";
import type { ReadabilityResult } from "../services/readabilityCheck";
import type { MetadataCheckResult } from "../services/metadataCheck";
import type { TechnicalResult } from "../services/technicalCheck";

export interface GeoRecommendation {
  title: string;
  severity: "high" | "medium" | "low";
  description: string;
}

export interface GeoScoringResult {
  score: {
    value: number;
    max: number;
  };
  categories: {
    crawlability: number;
    schema: number;
    content: number;
    metadata: number;
    authority: number;
    technical: number;
  };
  checks: {
    robotsAllowed: boolean;
    llmsTxt: boolean;
    sitemap: boolean;
    schema: boolean;
    faqSchema: boolean;
    metaDescription: boolean;
    canonical: boolean;
    author: boolean;
    publishedDate: boolean;
    openGraph: boolean;
    twitterCards: boolean;
    readability: boolean;
    technical: boolean;
  };
  recommendations: GeoRecommendation[];
}

export function calculateGeoScore(
  robots: RobotsResult,
  llmsTxt: LlmsTxtResult,
  sitemap: SitemapResult,
  schema: SchemaResult,
  contentStr: ContentStructureResult,
  readability: ReadabilityResult,
  metaCheck: MetadataCheckResult,
  technical: TechnicalResult
): GeoScoringResult {
  const recommendations: GeoRecommendation[] = [];

  // 1. Crawlability: AI Bots Allowed (Max 15)
  const totalTargetBots = robots.allowedBots.length + robots.blockedBots.length;
  const isRobotsAllowed = robots.blockedBots.length === 0;
  let crawlabilityScore = 15;
  if (totalTargetBots > 0) {
    crawlabilityScore = Math.round((robots.allowedBots.length / totalTargetBots) * 15);
  }
  if (!isRobotsAllowed) {
    recommendations.push({
      title: "AI Bots Blocked in robots.txt",
      severity: "medium",
      description: `Your robots.txt blocks ${robots.blockedBots.length} AI bot(s) (${robots.blockedBots.join(", ")}). Consider removing these restrictions so generative search models can cite your site.`
    });
  }

  // 2. llms.txt (Max 10) inside Authority
  const isLlmsTxt = llmsTxt.present;
  const llmsTxtScore = isLlmsTxt ? 10 : 0;
  if (!isLlmsTxt) {
    recommendations.push({
      title: "Missing llms.txt file",
      severity: "high",
      description: "Create an llms.txt file in the root of your site (e.g. /llms.txt) to provide a clean, LLM-friendly index of your content."
    });
  }

  // 3. Sitemap (Max 5) inside Metadata
  const isSitemap = sitemap.valid;
  const sitemapScore = isSitemap ? 5 : 0;
  if (!isSitemap) {
    recommendations.push({
      title: "Sitemap Missing or Invalid",
      severity: "medium",
      description: "Ensure you have a valid, well-structured sitemap.xml to help search crawlers and AI indexes discover all your URLs."
    });
  }

  // 4. Schema (Max 15) and FAQ/HowTo (Max 5) inside Schema
  const isSchema = schema.hasSchema;
  const schemaScore = isSchema ? 15 : 0;
  if (!isSchema) {
    recommendations.push({
      title: "Structured Schema Missing",
      severity: "high",
      description: "Implement JSON-LD structured data schemas (like Article, Product, Organization, or Person) to help AI systems identify core entities."
    });
  }

  const hasFaqOrHowTo = schema.types.includes("FAQPage") || schema.types.includes("HowTo") || readability.faqSection;
  const faqScore = hasFaqOrHowTo ? 5 : 0;
  if (!hasFaqOrHowTo) {
    recommendations.push({
      title: "FAQ/HowTo Structured Data Missing",
      severity: "low",
      description: "Consider adding FAQ or HowTo JSON-LD schemas. These direct mappings are heavily used by search engines for AI-powered rich snippets and conversational RAG citation results."
    });
  }

  // 5. Meta Description (Max 5) inside Content
  const isMetaDesc = contentStr.hasMetaDescription;
  const metaDescScore = isMetaDesc ? 5 : 0;
  if (!isMetaDesc) {
    recommendations.push({
      title: "Meta Description Missing",
      severity: "high",
      description: "Add a custom meta description tag. Generative search engines parse this summary to formulate snippets and response citations."
    });
  }

  // 6. Canonical (Max 5) inside Content
  const isCanonical = contentStr.canonical;
  const canonicalScore = isCanonical ? 5 : 0;
  if (!isCanonical) {
    recommendations.push({
      title: "Canonical Link Tag Missing",
      severity: "medium",
      description: "Define a canonical link tag to consolidate page ranking authority and prevent duplicates from confusing crawler pipelines."
    });
  }

  // 7. Author (Max 5) inside Authority
  const isAuthor = contentStr.hasAuthor;
  const authorScore = isAuthor ? 5 : 0;
  if (!isAuthor) {
    recommendations.push({
      title: "Author Metadata Missing",
      severity: "medium",
      description: "Specify the content author name inside metadata tags or schema parameters. Validating creator identity is key for E-E-A-T score signals."
    });
  }

  // 8. Published Date (Max 5) inside Authority
  const isPublishedDate = contentStr.hasPublishedDate;
  const publishedDateScore = isPublishedDate ? 5 : 0;
  if (!isPublishedDate) {
    recommendations.push({
      title: "Publication Date Missing",
      severity: "medium",
      description: "Add metadata indicating publication or modification date so AI systems can verify information freshness."
    });
  }

  // 9. OpenGraph (Max 5) inside Metadata
  const isOg = metaCheck.openGraph;
  const ogScore = isOg ? 5 : 0;
  if (!isOg) {
    recommendations.push({
      title: "Incomplete OpenGraph Tags",
      severity: "low",
      description: "Ensure complete og:title, og:description, and og:image tags are present to format rich social previews."
    });
  }

  // 10. Twitter Cards (Max 5) inside Metadata
  const isTwitter = metaCheck.twitterCards;
  const twitterScore = isTwitter ? 5 : 0;
  if (!isTwitter) {
    recommendations.push({
      title: "Incomplete Twitter Cards Metadata",
      severity: "low",
      description: "Add twitter:card and twitter:title meta tags to control preview aesthetics."
    });
  }

  // 11. Readability (Max 10) inside Content
  const isReadabilityOk = readability.paragraphLength >= 8 && readability.paragraphLength <= 150 && readability.headingCount >= 1;
  const readabilityScore = isReadabilityOk ? 10 : (readability.headingCount >= 1 ? 5 : 0);
  if (!isReadabilityOk) {
    recommendations.push({
      title: "Optimize Document Readability",
      severity: "medium",
      description: "Improve page structure by balancing paragraph length (aim for 8-150 words per paragraph) and using descriptive headings."
    });
  }

  // 12. Technical (Max 10) inside Technical
  let technicalScore = 0;
  if (technical.viewport) technicalScore += 4;
  if (technical.charset) technicalScore += 3;
  if (technical.indexable) technicalScore += 3;

  const isTechnicalOk = technical.viewport && technical.charset && technical.indexable;
  if (!isTechnicalOk) {
    let techMsg = "Verify your viewport tags, charset declarations, and ensure indexability rules do not disallow bots.";
    if (!technical.indexable) techMsg = "Your page is set to 'noindex', which completely blocks AI and search engine crawlers from indexing this site.";
    recommendations.push({
      title: "Technical Meta Warnings",
      severity: "high",
      description: techMsg
    });
  }

  // Category mapping summation
  const crawlability = crawlabilityScore;
  const schemaCat = schemaScore + faqScore;
  const content = readabilityScore + metaDescScore + canonicalScore;
  const metadata = ogScore + twitterScore + sitemapScore;
  const authority = llmsTxtScore + authorScore + publishedDateScore;
  const technicalCat = technicalScore;

  const totalValue = crawlability + schemaCat + content + metadata + authority + technicalCat;

  return {
    score: {
      value: totalValue,
      max: 100
    },
    categories: {
      crawlability,
      schema: schemaCat,
      content,
      metadata,
      authority,
      technical: technicalCat
    },
    checks: {
      robotsAllowed: isRobotsAllowed,
      llmsTxt: isLlmsTxt,
      sitemap: isSitemap,
      schema: isSchema,
      faqSchema: hasFaqOrHowTo,
      metaDescription: isMetaDesc,
      canonical: isCanonical,
      author: isAuthor,
      publishedDate: isPublishedDate,
      openGraph: isOg,
      twitterCards: isTwitter,
      readability: isReadabilityOk,
      technical: isTechnicalOk
    },
    recommendations
  };
}
