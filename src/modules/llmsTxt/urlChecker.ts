import axios from 'axios';
import { assertPublicUrl, safeRedirects, UnsafeUrlError } from '../../lib/safeUrl.js';
import { validateLlmsTxt } from './llmsTxtValidator.js';
import { checkLinks } from './linkChecker.js';
import type { UrlCheckResult } from './types.js';

const MAX_BYTES = 1024 * 1024; // 1 MB max for llms.txt files
const FETCH_TIMEOUT_MS = 8000;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) AnavyaLlmsTxtChecker/1.0',
  Accept: 'text/markdown,text/plain,text/x-markdown;q=1.0,*/*;q=0.5',
};

export class UrlCheckError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'UrlCheckError';
  }
}

/**
 * Normalizes input URL so that if a domain or base path is passed without a file,
 * it automatically targets /llms.txt (e.g. "https://example.com" -> "https://example.com/llms.txt").
 */
export function resolveLlmsTxtUrl(input: string): string {
  let trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname;
    if (pathname === '/' || pathname === '' || !pathname.endsWith('.txt')) {
      parsed.pathname = pathname.replace(/\/+$/, '') + '/llms.txt';
      return parsed.toString();
    }
  } catch {
    // If invalid URL, return original trimmed to let assertPublicUrl handle it
  }
  return trimmed;
}

/**
 * Fetches a published llms.txt URL securely and performs specification validation
 * and link availability checks.
 */
export async function checkPublishedUrl(targetUrl: string): Promise<UrlCheckResult> {
  const resolvedTarget = resolveLlmsTxtUrl(targetUrl);

  // Step 1: Pre-flight SSRF & URL validation
  let validatedUrl: string;
  try {
    validatedUrl = await assertPublicUrl(resolvedTarget);
  } catch (err: any) {
    throw new UrlCheckError(err.message || 'The specified URL is not a valid public address.', 400);
  }

  // Step 2: Fetch the remote published file
  let response;
  try {
    response = await axios.get(validatedUrl, {
      ...safeRedirects,
      timeout: FETCH_TIMEOUT_MS,
      headers: HEADERS,
      responseType: 'text',
      transformResponse: (data) => data,
      maxContentLength: MAX_BYTES,
      validateStatus: () => true, // capture all status codes
    });
  } catch (err: any) {
    if (err instanceof UnsafeUrlError) {
      throw new UrlCheckError('Redirect to a private or disallowed address was blocked.', 400);
    }
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      throw new UrlCheckError(`Request timed out after ${FETCH_TIMEOUT_MS}ms while fetching ${validatedUrl}.`, 504);
    }
    if (err.response?.status === 413 || err.message?.includes('maxContentLength')) {
      throw new UrlCheckError('The published file exceeds the 1 MB maximum allowed size.', 413);
    }
    throw new UrlCheckError(`Failed to fetch published file: ${err.message || 'Network error'}`, 502);
  }

  const httpStatus = response.status;
  const finalUrl = response.request?.res?.responseUrl ?? validatedUrl;
  const headers = Object.fromEntries(
    Object.entries(response.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)])
  );
  const contentType = headers['content-type'] ?? '';
  const rawBody = typeof response.data === 'string' ? response.data : '';

  // Step 3: Handle non-200 HTTP statuses as diagnostic findings rather than hard 422 errors
  if (httpStatus < 200 || httpStatus >= 300) {
    const notFoundMessage =
      httpStatus === 404
        ? `No llms.txt file found at ${validatedUrl} (HTTP 404 Not Found).`
        : `Remote server responded with HTTP ${httpStatus} (${response.statusText || 'Error'}). File could not be retrieved.`;

    return {
      requestedUrl: targetUrl,
      finalUrl,
      httpStatus,
      contentType,
      isMarkdown: false,
      validation: {
        summary: {
          valid: false,
          errors: 1,
          warnings: 0,
          passed: 0,
          skipped: 0,
          score: 0,
        },
        checks: [
          {
            id: 'http-status',
            name: 'File Availability (HTTP 200)',
            status: 'fail',
            severity: 'error',
            message: notFoundMessage,
            explanation:
              'An llms.txt file must be publicly reachable with an HTTP 200 OK status so AI systems and LLM crawlers can discover and cite your content.',
            suggestedCorrection:
              'Generate an llms.txt file using our Generator tool and upload it to your web server root (/llms.txt).',
          },
        ],
        links: [],
        markdown: rawBody || '',
      },
      linkChecks: {
        summary: {
          total: 0,
          ok: 0,
          broken: 0,
          redirected: 0,
          duplicate: 0,
          inconclusive: 0,
        },
        links: [],
      },
    };
  }

  // Step 4: Detect whether response is an HTML page (SPA shell or 404 page)
  const isHtml =
    /text\/html/i.test(contentType) ||
    /^\s*<!doctype\s+html/i.test(rawBody) ||
    /^\s*<html[\s>]/i.test(rawBody);

  const isMarkdown = !isHtml;

  // Step 5: Run Shared Validation Service
  const validation = validateLlmsTxt(rawBody);

  // If response is HTML, add an explicit check finding
  if (isHtml) {
    validation.checks.unshift({
      id: 'http-content-type',
      name: 'Content Type',
      status: 'fail',
      severity: 'error',
      message: 'The URL returned an HTML document instead of raw Markdown text.',
      explanation:
        'The llms.txt standard specifies that the file must be served as plain Markdown. Ensure your web server or SPA does not return an HTML fallback.',
      suggestedCorrection: 'Configure your server to serve llms.txt with Content-Type: text/markdown or text/plain.',
    });
    validation.summary.valid = false;
    validation.summary.errors++;
    validation.summary.score = Math.max(0, validation.summary.score - 40);
  } else {
    validation.checks.unshift({
      id: 'http-content-type',
      name: 'Content Type',
      status: 'pass',
      severity: 'error',
      message: `File served with valid non-HTML content type (${contentType || 'plain/text'}).`,
    });
    validation.summary.passed++;
  }

  // Step 6: Run Reusable Link-Checking Service on extracted links
  const linkChecks = await checkLinks(validation.links, {
    timeoutMs: 5000,
    concurrency: 5,
    maxLinks: 30,
  });

  return {
    requestedUrl: targetUrl,
    finalUrl,
    httpStatus,
    contentType,
    isMarkdown,
    validation,
    linkChecks,
  };
}
