import * as cheerio from 'cheerio';
import axios from 'axios';
import { assertPublicUrl, getOrigin, safeRedirects, UnsafeUrlError } from '../../lib/safeUrl.js';
import { validateLlmsTxt } from './llmsTxtValidator.js';
import { loadSitemapUrls } from '../audit/discover.js';
import type { GeneratorResult } from './types.js';
import { UrlCheckError } from './urlChecker.js';

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) AnavyaLlmsTxtGenerator/1.0',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const IGNORE_PATTERNS = [
  /\/(login|signin|signup|register|auth|logout|cart|checkout|account|billing|my-account)(\/|$)/i,
  /\/(privacy|terms|legal|cookies?|security|accessibility|gdpr)(\/|$)/i,
  /\/(wp-admin|wp-content|wp-json|cdn-cgi|assets|static)(\/|$)/i,
  /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|woff2?|pdf|zip|tar|gz)$/i,
];

function cleanTitle(raw: string): string {
  return raw
    .split(/\s*[-–—|•:]\s*/)[0]
    ?.trim() || raw.trim();
}

function pathSegmentToTitle(pathname: string): string {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return 'Home';

  return last
    .replace(/[-_]+/g, ' ')
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

interface CategorizedLinks {
  documentation: { title: string; url: string; description?: string }[];
  api: { title: string; url: string; description?: string }[];
  products: { title: string; url: string; description?: string }[];
  company: { title: string; url: string; description?: string }[];
  blog: { title: string; url: string; description?: string }[];
  optional: { title: string; url: string; description?: string }[];
}

/**
 * Generates an llms.txt Markdown draft deterministically from a website's
 * public homepage metadata, navigation links, and accessible sitemap.
 */
export async function generateLlmsTxt(websiteUrl: string): Promise<GeneratorResult> {
  const warnings: string[] = [];

  // Step 1: Validate website URL and guard against SSRF
  let validUrl: string;
  try {
    validUrl = await assertPublicUrl(websiteUrl);
  } catch (err: any) {
    if (err instanceof UnsafeUrlError) {
      throw new UrlCheckError(err.message, 400);
    }
    throw new UrlCheckError('Invalid website URL provided.', 400);
  }

  const origin = getOrigin(validUrl);
  const parsedOrigin = new URL(origin);
  const domain = parsedOrigin.hostname.replace(/^www\./, '');

  // Step 2: Fetch homepage
  let homepageHtml = '';
  try {
    const res = await axios.get(validUrl, {
      ...safeRedirects,
      timeout: FETCH_TIMEOUT_MS,
      headers: HEADERS,
      responseType: 'text',
      maxContentLength: MAX_BYTES,
      validateStatus: (status) => status >= 200 && status < 300,
    });
    homepageHtml = typeof res.data === 'string' ? res.data : '';
  } catch (err: any) {
    throw new UrlCheckError(
      `Could not retrieve public homepage from ${validUrl}: ${err.message || 'Connection error'}.`,
      422
    );
  }

  // Step 3: Parse homepage metadata using cheerio
  const $ = cheerio.load(homepageHtml);

  // Extract site title
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  const metaTitle = $('meta[name="twitter:title"]').attr('content')?.trim();
  const tagTitle = $('title').text().trim();
  const rawTitle = ogTitle || metaTitle || tagTitle || domain;
  const projectTitle = cleanTitle(rawTitle) || domain;

  if (!tagTitle && !ogTitle) {
    warnings.push('No HTML <title> tag detected on homepage; defaulted project title to domain name.');
  }

  // Extract description/summary
  const metaDesc =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('meta[name="twitter:description"]').attr('content')?.trim();

  let summary = metaDesc;
  if (!summary) {
    // Attempt first paragraph in main or body
    const firstP = $('main p, article p, body p')
      .first()
      .text()
      .trim()
      .slice(0, 200);
    if (firstP && firstP.length > 30) {
      summary = firstP;
    } else {
      summary = `${projectTitle} official documentation, guides, and resources for AI systems.`;
      warnings.push('No meta description found on homepage; generated baseline summary.');
    }
  }

  // Step 4: Discover candidate URLs from homepage navigation & sitemap
  const discoveredUrlMap = new Map<string, { title: string; url: string; description?: string }>();

  // Extract navigation links from homepage HTML
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!href) return;

    try {
      const full = new URL(href, validUrl);
      // Keep only same origin HTTP/HTTPS links
      if (full.origin !== origin || !/^https?:$/.test(full.protocol)) return;
      if (IGNORE_PATTERNS.some((pattern) => pattern.test(full.pathname))) return;

      const cleanFullUrl = `${full.origin}${full.pathname.replace(/\/+$/, '') || '/'}`;
      if (cleanFullUrl === origin || cleanFullUrl === `${origin}/`) return;

      const pageTitle = text.length > 2 && text.length < 50 ? text : pathSegmentToTitle(full.pathname);
      if (!discoveredUrlMap.has(cleanFullUrl)) {
        discoveredUrlMap.set(cleanFullUrl, { title: pageTitle, url: cleanFullUrl });
      }
    } catch {
      // ignore invalid relative URLs
    }
  });

  // Try sitemaps
  try {
    const sitemapCandidates = [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemap/sitemap.xml`,
    ];
    const sitemapResult = await loadSitemapUrls(sitemapCandidates);

    if (sitemapResult.found && sitemapResult.urls.length > 0) {
      for (const rawLoc of sitemapResult.urls) {
        try {
          const locUrl = new URL(rawLoc);
          if (locUrl.origin !== origin) continue;
          if (IGNORE_PATTERNS.some((pattern) => pattern.test(locUrl.pathname))) continue;

          const cleanLoc = `${locUrl.origin}${locUrl.pathname.replace(/\/+$/, '') || '/'}`;
          if (cleanLoc === origin || cleanLoc === `${origin}/`) continue;

          if (!discoveredUrlMap.has(cleanLoc)) {
            discoveredUrlMap.set(cleanLoc, {
              title: pathSegmentToTitle(locUrl.pathname),
              url: cleanLoc,
            });
          }
        } catch {
          // ignore malformed locs
        }
      }
    } else {
      warnings.push('No public sitemap.xml found; generated sections from homepage navigation.');
    }
  } catch {
    warnings.push('Failed to load sitemap.xml; relied on homepage navigation links.');
  }

  // Step 5: Categorize URLs into standard llms.txt sections
  const sections: CategorizedLinks = {
    documentation: [],
    api: [],
    products: [],
    company: [],
    blog: [],
    optional: [],
  };

  for (const item of discoveredUrlMap.values()) {
    const p = new URL(item.url).pathname.toLowerCase();

    if (/\/(changelog|releases?|archive|legacy|deprecated)(\/|$)/.test(p)) {
      sections.optional.push(item);
    } else if (/\/(docs?|documentation|guides?|tutorials?|learn|manual|help)(\/|$)/.test(p)) {
      sections.documentation.push(item);
    } else if (/\/(api|endpoints?|sdk|reference|developers?)(\/|$)/.test(p)) {
      sections.api.push(item);
    } else if (/\/(features?|products?|solutions?|services?|pricing|tools?)(\/|$)/.test(p)) {
      sections.products.push(item);
    } else if (/\/(about|team|company|contact|careers|mission)(\/|$)/.test(p)) {
      sections.company.push(item);
    } else if (/\/(blog|news|articles?|insights|posts?)(\/|$)/.test(p)) {
      // Limit blog posts to recent 3
      if (sections.blog.length < 3) {
        sections.blog.push(item);
      }
    } else if (sections.documentation.length < 5) {
      // Secondary fallback to documentation if general page
      sections.documentation.push(item);
    }
  }

  // Step 6: Assemble compliant Markdown draft
  const draftLines: string[] = [
    `# ${projectTitle}`,
    '',
    `> ${summary}`,
    '',
  ];

  const renderSection = (title: string, items: { title: string; url: string; description?: string }[]) => {
    if (items.length === 0) return;
    draftLines.push(`## ${title}`);
    draftLines.push('');
    for (const item of items.slice(0, 10)) {
      const desc = item.description ? `: ${item.description}` : '';
      draftLines.push(`- [${item.title}](${item.url})${desc}`);
    }
    draftLines.push('');
  };

  renderSection('Documentation', sections.documentation);
  renderSection('API Reference', sections.api);
  renderSection('Features & Solutions', sections.products);
  renderSection('Company', sections.company);
  renderSection('Blog', sections.blog);
  renderSection('Optional', sections.optional);

  // Fallback: If no links were discovered, include home link
  if (discoveredUrlMap.size === 0) {
    draftLines.push('## Documentation');
    draftLines.push('');
    draftLines.push(`- [${projectTitle} Home](${origin}): Main website portal`);
    draftLines.push('');
    warnings.push('Could not discover subpages; included primary site URL.');
  }

  const draftMarkdown = draftLines.join('\n').trim() + '\n';

  // Step 7: Validate generated output through shared validation service
  const validation = validateLlmsTxt(draftMarkdown);

  return {
    draft: draftMarkdown,
    validation,
    warnings,
    discoveredPagesCount: discoveredUrlMap.size,
  };
}
