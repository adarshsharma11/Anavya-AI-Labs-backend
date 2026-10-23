import { fetchResource } from "./fetch.js";

export const MAX_EXTRA_PAGES = 5;
const MAX_SITEMAP_URLS = 500;

const SKIP_PATH = /\.(jpe?g|png|gif|webp|svg|pdf|zip|xml|txt|css|js|mp4|mp3)$|\/(tag|tags|category|categories|author|page|feed|wp-json|cart|checkout|login|signin|signup|account)(\/|$)/i;

const BUCKETS: readonly RegExp[] = [
  /\/(services?|solutions?|features?|what-we-do)(\/|$)/i,
  /\/(pricing|plans?)(\/|$)/i,
  /\/(blog|news|articles?|posts?|insights|guides?|resources)\/[^/]+/i,
  /\/(about|about-us|company|team)(\/|$)/i,
  /\/(products?|shop)\/[^/]+/i,
  /\/(contact|contact-us)(\/|$)/i,
];

const sameSite = (a: string, b: string) => a.replace(/^www\./, "") === b.replace(/^www\./, "");

export const extractSitemapLocs = (xml: string) =>
  [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1]!.trim());

export async function loadSitemapUrls(candidates: readonly string[]) {
  for (const sitemapUrl of candidates) {
    const res = await fetchResource(sitemapUrl, 6000);
    if (!res.ok || !/<(urlset|sitemapindex)/i.test(res.body)) continue;

    if (/<sitemapindex/i.test(res.body)) {
      const children = extractSitemapLocs(res.body)
        .sort((a, b) => Number(/page|post/i.test(b)) - Number(/page|post/i.test(a)))
        .slice(0, 2);
      const nested = await Promise.all(children.map((child) => fetchResource(child, 6000)));
      const urls = nested.flatMap((r) => (r.ok ? extractSitemapLocs(r.body) : []));
      return { found: true, urls: urls.slice(0, MAX_SITEMAP_URLS) };
    }
    return { found: true, urls: extractSitemapLocs(res.body).slice(0, MAX_SITEMAP_URLS) };
  }
  return { found: false, urls: [] as string[] };
}

export function selectKeyPages(homepageUrl: string, candidates: readonly string[], max = MAX_EXTRA_PAGES) {
  const home = new URL(homepageUrl);
  const homeKey = `${home.hostname.replace(/^www\./, "")}${home.pathname.replace(/\/$/, "")}`;
  const seen = new Set<string>([homeKey]);
  const pool: URL[] = [];

  for (const raw of candidates) {
    let url: URL;
    try {
      url = new URL(raw, homepageUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || !sameSite(url.hostname, home.hostname)) continue;
    if (url.search || SKIP_PATH.test(url.pathname)) continue;
    const key = `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    url.hash = "";
    pool.push(url);
  }

  const picked: URL[] = [];
  for (const bucket of BUCKETS) {
    const match = pool.find((u) => bucket.test(u.pathname) && !picked.includes(u));
    if (match) picked.push(match);
    if (picked.length >= max) break;
  }
  const rest = pool
    .filter((u) => !picked.includes(u))
    .sort((a, b) => a.pathname.split("/").length - b.pathname.split("/").length || a.pathname.length - b.pathname.length);
  return [...picked, ...rest].slice(0, max).map((u) => u.toString());
}
