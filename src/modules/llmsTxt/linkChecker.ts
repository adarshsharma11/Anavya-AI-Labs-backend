import axios from 'axios';
import { assertPublicUrl, safeRedirects, UnsafeUrlError } from '../../lib/safeUrl.js';
import type { ExtractedLink, LinkCheckItem, LinkCheckReport, LinkCheckSummary } from './types.js';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) AnavyaLlmsTxtChecker/1.0',
  Accept: 'text/html,text/plain,text/markdown,*/*;q=0.8',
};

const DEFAULT_TIMEOUT_MS = 6000;
const MAX_CONCURRENT_CHECKS = 5;
const MAX_LINKS_TO_CHECK = 50; // Safeguard against denial of service / massive scans

export interface CheckLinksOptions {
  timeoutMs?: number;
  concurrency?: number;
  maxLinks?: number;
}

/**
 * Checks a single URL safely, respecting timeouts, redirects, and SSRF restrictions.
 */
export async function checkSingleUrl(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<{
  status: 'ok' | 'broken' | 'redirect' | 'inconclusive';
  httpStatus?: number;
  finalUrl?: string;
  message?: string;
}> {
  // Step 1: Validate URL syntax and SSRF protection
  let safeTargetUrl: string;
  try {
    safeTargetUrl = await assertPublicUrl(url);
  } catch (err: any) {
    if (err instanceof UnsafeUrlError) {
      return {
        status: 'broken',
        message: err.message || 'URL blocked by security policy.',
      };
    }
    return {
      status: 'broken',
      message: 'Invalid URL format.',
    };
  }

  // Step 2: Try HEAD request first for efficiency
  const requestConfig = {
    ...safeRedirects,
    timeout: timeoutMs,
    headers: HEADERS,
    validateStatus: () => true, // Don't throw on 4xx/5xx
  };

  try {
    let res = await axios.head(safeTargetUrl, requestConfig);

    // If server does not support HEAD (405 Method Not Allowed), fall back to GET
    if (res.status === 405 || res.status === 501) {
      res = await axios.get(safeTargetUrl, {
        ...requestConfig,
        responseType: 'stream', // Don't download entire body
      });
    }

    const httpStatus = res.status;
    const finalUrl = res.request?.res?.responseUrl ?? safeTargetUrl;
    const wasRedirected = finalUrl !== safeTargetUrl;

    if (httpStatus >= 200 && httpStatus < 300) {
      if (wasRedirected) {
        return {
          status: 'redirect',
          httpStatus,
          finalUrl,
          message: `Redirected to ${finalUrl} (HTTP ${httpStatus})`,
        };
      }
      return {
        status: 'ok',
        httpStatus,
        finalUrl,
        message: `HTTP ${httpStatus} OK`,
      };
    }

    if (httpStatus >= 300 && httpStatus < 400) {
      return {
        status: 'redirect',
        httpStatus,
        finalUrl,
        message: `Redirected with HTTP ${httpStatus}`,
      };
    }

    if (httpStatus >= 400) {
      return {
        status: 'broken',
        httpStatus,
        finalUrl,
        message: `HTTP ${httpStatus} ${res.statusText || 'Error'}`,
      };
    }

    return {
      status: 'inconclusive',
      httpStatus,
      finalUrl,
      message: `Unexpected HTTP status ${httpStatus}`,
    };
  } catch (err: any) {
    // Distinguish confirmed failures from transient network errors
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return {
        status: 'inconclusive',
        message: 'Request timed out after ' + timeoutMs + 'ms',
      };
    }

    if (err instanceof UnsafeUrlError) {
      return {
        status: 'broken',
        message: 'Blocked redirect to private/internal network destination',
      };
    }

    // DNS or connection failures
    return {
      status: 'inconclusive',
      message: err.message || 'Network connection failed',
    };
  }
}

/**
 * Checks a collection of extracted links with concurrency control, deduplication, and limits.
 */
export async function checkLinks(
  extractedLinks: ExtractedLink[],
  options: CheckLinksOptions = {}
): Promise<LinkCheckReport> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const concurrency = options.concurrency ?? MAX_CONCURRENT_CHECKS;
  const maxLinks = options.maxLinks ?? MAX_LINKS_TO_CHECK;

  const linksToProcess = extractedLinks.slice(0, maxLinks);
  // Collect unique URLs in order of appearance
  const uniqueUrls: string[] = [];
  const seenNorm = new Set<string>();

  for (const item of linksToProcess) {
    const norm = item.url.trim().toLowerCase();
    if (!seenNorm.has(norm)) {
      seenNorm.add(norm);
      uniqueUrls.push(item.url);
    }
  }

  // Check unique URLs using concurrency limit pool
  const urlResults = new Map<string, {
    status: 'ok' | 'broken' | 'redirect' | 'inconclusive';
    httpStatus?: number;
    finalUrl?: string;
    message?: string;
  }>();

  let queueIndex = 0;
  const executeWorker = async () => {
    while (queueIndex < uniqueUrls.length) {
      const idx = queueIndex++;
      const targetUrl = uniqueUrls[idx]!;
      const norm = targetUrl.trim().toLowerCase();
      const res = await checkSingleUrl(targetUrl, timeoutMs);
      urlResults.set(norm, res);
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, uniqueUrls.length) },
    () => executeWorker()
  );
  await Promise.all(workers);

  // Map back to each link item preserving duplicate statuses
  const results: LinkCheckItem[] = [];
  const seenInResult = new Set<string>();

  for (const item of linksToProcess) {
    const norm = item.url.trim().toLowerCase();
    const isDup = seenInResult.has(norm);
    seenInResult.add(norm);

    const checkRes = urlResults.get(norm) ?? {
      status: 'inconclusive' as const,
      message: 'Not checked',
    };

    results.push({
      url: item.url,
      title: item.title,
      section: item.section,
      line: item.line,
      status: checkRes.status,
      httpStatus: checkRes.httpStatus,
      finalUrl: checkRes.finalUrl,
      message: checkRes.message,
      isDuplicate: isDup,
    });
  }

  // Compute summary
  let ok = 0;
  let broken = 0;
  let redirected = 0;
  let duplicate = 0;
  let inconclusive = 0;

  for (const r of results) {
    if (!r) continue;
    if (r.isDuplicate) {
      duplicate++;
    } else if (r.status === 'ok') {
      ok++;
    } else if (r.status === 'broken') {
      broken++;
    } else if (r.status === 'redirect') {
      redirected++;
    } else if (r.status === 'inconclusive') {
      inconclusive++;
    }
  }

  const summary: LinkCheckSummary = {
    total: results.length,
    ok,
    broken,
    redirected,
    duplicate,
    inconclusive,
  };

  return {
    summary,
    links: results,
  };
}
