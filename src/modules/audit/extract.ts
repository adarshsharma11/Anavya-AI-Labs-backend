import * as cheerio from "cheerio";
import type { PageType } from "./types.js";

export interface SchemaNode {
  readonly types: readonly string[];
  readonly data: Readonly<Record<string, unknown>>;
}

export interface PageData {
  readonly url: string;
  readonly host: string;
  readonly path: string;
  readonly isHttps: boolean;
  readonly sizeKB: number;
  readonly lang: string;
  readonly title: string;
  readonly metaDescription: string;
  readonly canonical: string;
  readonly viewport: boolean;
  readonly noindex: boolean;
  readonly og: { readonly title: string; readonly description: string; readonly image: string; readonly type: string };
  readonly twitterCard: string;
  readonly h1: readonly string[];
  readonly subheadings: readonly string[];
  readonly h2Count: number;
  readonly h3Count: number;
  readonly paragraphs: readonly string[];
  readonly openingParagraph: string;
  readonly wordCount: number;
  readonly avgSentenceWords: number;
  readonly listItems: number;
  readonly tables: number;
  readonly orderedStepLists: number;
  readonly faqPairs: number;
  readonly images: number;
  readonly imagesWithAlt: number;
  readonly lazyImages: number;
  readonly renderBlockingScripts: number;
  readonly stylesheets: number;
  readonly internalLinks: readonly string[];
  readonly externalHosts: readonly string[];
  readonly hasAboutOrContactLink: boolean;
  readonly author: string;
  readonly publishedAt: string;
  readonly modifiedAt: string;
  readonly schema: readonly SchemaNode[];
  readonly schemaTypes: readonly string[];
  readonly pageType: PageType;
}

const QUESTION_START = /^(what|how|why|when|where|who|which|is|are|can|does|do|should|will)\b/i;
export const isQuestionHeading = (text: string) => QUESTION_START.test(text.trim()) || text.trim().endsWith("?");

const words = (text: string) => text.split(/\s+/).filter(Boolean);
const clean = (text: string) => text.replace(/\s+/g, " ").trim();

const typesOf = (node: Record<string, unknown>): string[] => {
  const t = node["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
};

const flattenSchema = (value: unknown, out: SchemaNode[] = []): SchemaNode[] => {
  if (Array.isArray(value)) {
    value.forEach((v) => flattenSchema(v, out));
  } else if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    const types = typesOf(node);
    if (types.length) out.push({ types, data: node });
    Object.entries(node).forEach(([key, v]) => {
      if (key !== "@context" && typeof v === "object") flattenSchema(v, out);
    });
  }
  return out;
};

const schemaString = (schema: readonly SchemaNode[], key: string) => {
  for (const node of schema) {
    const value = node.data[key];
    if (typeof value === "string" && value) return value;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const name = (value as Record<string, unknown>).name;
      if (typeof name === "string" && name) return name;
    }
    if (Array.isArray(value) && value.length) {
      const first = value[0] as Record<string, unknown> | string;
      if (typeof first === "string") return first;
      if (first && typeof first.name === "string") return first.name;
    }
  }
  return "";
};

const ARTICLE_TYPES = ["Article", "BlogPosting", "NewsArticle", "TechArticle", "Report"];
const ARTICLE_PATH = /\/(blog|news|articles?|posts?|insights|guides?|resources|learn)\/[^/]+/i;

export const detectPageType = (path: string, ogType: string, schemaTypes: readonly string[]): PageType => {
  if (/^\/?(index\.(html?|php))?$/i.test(path) || /^\/[a-z]{2}(-[a-z]{2})?\/?$/i.test(path)) return "homepage";
  if (schemaTypes.includes("Product") || /product/i.test(ogType) || /\/products?\//i.test(path)) return "product";
  if (
    schemaTypes.some((t) => ARTICLE_TYPES.includes(t)) ||
    /article/i.test(ogType) ||
    ARTICLE_PATH.test(path)
  ) {
    return "article";
  }
  return "page";
};

export function extractPage(url: string, html: string): PageData {
  const $ = cheerio.load(html);
  const parsed = new URL(url);
  const meta = (selector: string) => clean($(selector).attr("content") ?? "");

  const schema: SchemaNode[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      flattenSchema(JSON.parse($(el).contents().text()), schema);
    } catch {
      // Ignore malformed JSON-LD blocks; other blocks still count.
    }
  });
  $("[itemtype]").each((_, el) => {
    const type = ($(el).attr("itemtype") ?? "").split("/").pop();
    if (type) schema.push({ types: [type], data: {} });
  });
  const schemaTypes = [...new Set(schema.flatMap((s) => s.types))];

  const subheadings = $("h2, h3").map((_, el) => clean($(el).text())).get().filter(Boolean);
  const faqPairs = Math.max(
    $("details summary").length,
    subheadings.filter((h) => h.endsWith("?")).length,
    $('[class*="faq" i] [class*="question" i], [id*="faq" i] [class*="question" i]').length,
  );

  const links = $("a[href]").map((_, el) => ({ href: $(el).attr("href") ?? "", text: clean($(el).text()) })).get();
  const internalLinks = new Set<string>();
  const externalHosts = new Set<string>();
  let hasAboutOrContactLink = false;
  for (const { href, text } of links) {
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    try {
      const target = new URL(href, url);
      if (!/^https?:$/.test(target.protocol)) continue;
      const sameSite = target.hostname.replace(/^www\./, "") === parsed.hostname.replace(/^www\./, "");
      if (sameSite) {
        target.hash = "";
        internalLinks.add(target.toString());
        if (/about|contact/i.test(target.pathname) || /^(about|contact)/i.test(text)) hasAboutOrContactLink = true;
      } else {
        externalHosts.add(target.hostname.replace(/^www\./, ""));
      }
    } catch {
      // Skip unparseable hrefs.
    }
  }

  const images = $("img");
  const imageCount = images.length;
  const imagesWithAlt = images.filter((_, el) => $(el).attr("alt") !== undefined).length;
  const lazyImages = images.filter((_, el) => $(el).attr("loading") === "lazy").length;
  const renderBlockingScripts = $("head script[src]").filter((_, el) => {
    const s = $(el);
    return s.attr("async") === undefined && s.attr("defer") === undefined && s.attr("type") !== "module";
  }).length;
  const stylesheets = $('link[rel="stylesheet"]').length;
  const ogType = meta('meta[property="og:type"]');
  const head = {
    lang: clean($("html").attr("lang") ?? ""),
    title: clean($("title").first().text()),
    canonical: clean($('link[rel="canonical"]').attr("href") ?? ""),
    h1: $("h1").map((_, el) => clean($(el).text())).get(),
    h2Count: $("h2").length,
    h3Count: $("h3").length,
  };

  $("script, style, noscript, svg, template, iframe, nav, header, footer, aside, form").remove();
  const contentRoot = $("main").length ? $("main") : $("body");
  const paragraphs = contentRoot
    .find("p")
    .map((_, el) => clean($(el).text()))
    .get()
    .filter((p) => words(p).length >= 5);
  const contentText = clean(contentRoot.text());
  const sentences = paragraphs.flatMap((p) => p.split(/(?<=[.!?])\s+/)).filter((s) => words(s).length >= 3);
  const avgSentenceWords = sentences.length
    ? Math.round(sentences.reduce((sum, s) => sum + words(s).length, 0) / sentences.length)
    : 0;

  const orderedStepLists = contentRoot.find("ol").filter((_, el) => $(el).children("li").length >= 3).length +
    (subheadings.some((h) => /^step\s*\d/i.test(h)) ? 1 : 0);

  const author =
    meta('meta[name="author"]') ||
    schemaString(schema, "author") ||
    clean($('[rel="author"], [class*="author" i] [itemprop="name"], [class*="byline" i]').first().text());

  const path = parsed.pathname;

  return {
    url,
    host: parsed.hostname,
    path,
    isHttps: parsed.protocol === "https:",
    sizeKB: Math.round(Buffer.byteLength(html) / 1024),
    lang: head.lang,
    title: head.title,
    metaDescription: meta('meta[name="description"]'),
    canonical: head.canonical,
    viewport: Boolean(meta('meta[name="viewport"]')),
    noindex: /noindex/i.test(meta('meta[name="robots"]')),
    og: {
      title: meta('meta[property="og:title"]'),
      description: meta('meta[property="og:description"]'),
      image: meta('meta[property="og:image"]'),
      type: ogType,
    },
    twitterCard: meta('meta[name="twitter:card"]'),
    h1: head.h1,
    subheadings,
    h2Count: head.h2Count,
    h3Count: head.h3Count,
    paragraphs,
    openingParagraph: paragraphs[0] ?? "",
    wordCount: words(contentText).length,
    avgSentenceWords,
    listItems: contentRoot.find("li").length,
    tables: contentRoot.find("table").length,
    orderedStepLists,
    faqPairs,
    images: imageCount,
    imagesWithAlt,
    lazyImages,
    renderBlockingScripts,
    stylesheets,
    internalLinks: [...internalLinks],
    externalHosts: [...externalHosts],
    hasAboutOrContactLink,
    author,
    publishedAt: meta('meta[property="article:published_time"]') || schemaString(schema, "datePublished"),
    modifiedAt: meta('meta[property="article:modified_time"]') || schemaString(schema, "dateModified"),
    schema,
    schemaTypes,
    pageType: detectPageType(path, ogType, schemaTypes),
  };
}
