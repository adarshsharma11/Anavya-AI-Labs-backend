import type { Context } from 'hono';
import { validateLlmsTxt } from './llmsTxtValidator.js';
import { checkPublishedUrl, UrlCheckError } from './urlChecker.js';
import { logError } from '../../lib/errorLog.js';
import { getClientIp } from '../../lib/request.js';
import { consumeRateLimit } from '../../lib/rateLimiter.js';
import { UnsafeUrlError } from '../../lib/safeUrl.js';
import { env } from '../../config/env.js';

const MAX_CONTENT_LENGTH = 500 * 1024; // 500 KB
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

/**
 * Validates raw llms.txt Markdown content without outbound HTTP requests.
 * Endpoint: POST /api/tools/llms-txt/validate
 */
export const validateContentHandler = async (c: Context) => {
  try {
    const ip = getClientIp(c);
    if (env.NODE_ENV !== 'test' && !(await consumeRateLimit(`llmstxt:validate:${ip}`, MAX_REQUESTS_PER_WINDOW, RATE_LIMIT_WINDOW_MS))) {
      return c.json(
        { success: false, message: 'Too many validation requests. Please try again in a minute.' },
        429
      );
    }

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, message: 'Invalid JSON body. Expected { "content": string }' }, 400);
    }

    if (!body || typeof body.content !== 'string') {
      return c.json(
        { success: false, message: 'Field "content" is required and must be a string.' },
        400
      );
    }

    if (body.content.length > MAX_CONTENT_LENGTH) {
      return c.json(
        {
          success: false,
          message: `Content exceeds maximum allowed size of ${MAX_CONTENT_LENGTH / 1024} KB.`,
        },
        413
      );
    }

    const result = validateLlmsTxt(body.content);

    return c.json({
      success: true,
      data: {
        summary: result.summary,
        checks: result.checks,
        links: result.links,
        markdown: result.markdown,
        correctedMarkdown: result.correctedMarkdown,
      },
    });
  } catch (error: any) {
    logError('LLMS_TXT_VALIDATE', error);
    return c.json({ success: false, message: error.message || 'Failed to validate content.' }, 500);
  }
};

/**
 * Fetches and validates a published llms.txt URL.
 * Endpoint: POST /api/tools/llms-txt/check-url
 */
export const checkUrlHandler = async (c: Context) => {
  try {
    const ip = getClientIp(c);
    if (env.NODE_ENV !== 'test' && !(await consumeRateLimit(`llmstxt:checkurl:${ip}`, MAX_REQUESTS_PER_WINDOW, RATE_LIMIT_WINDOW_MS))) {
      return c.json(
        { success: false, message: 'Too many URL check requests. Please try again in a minute.' },
        429
      );
    }

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, message: 'Invalid JSON body. Expected { "url": string }' }, 400);
    }

    if (!body || typeof body.url !== 'string' || !body.url.trim()) {
      return c.json({ success: false, message: 'Field "url" is required and must be a valid URL string.' }, 400);
    }

    const result = await checkPublishedUrl(body.url.trim());

    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof UrlCheckError) {
      return c.json({ success: false, message: error.message }, error.statusCode as any);
    }
    if (error instanceof UnsafeUrlError) {
      return c.json({ success: false, message: error.message }, 400);
    }
    logError('LLMS_TXT_CHECK_URL', error);
    return c.json({ success: false, message: error.message || 'Failed to check published URL.' }, 500);
  }
};

/**
 * Generates a draft llms.txt Markdown file from a website URL.
 * Endpoint: POST /api/tools/llms-txt/generate
 */
export const generateHandler = async (c: Context) => {
  try {
    const ip = getClientIp(c);
    if (env.NODE_ENV !== 'test' && !(await consumeRateLimit(`llmstxt:generate:${ip}`, 15, RATE_LIMIT_WINDOW_MS))) {
      return c.json(
        { success: false, message: 'Too many generation requests. Please try again in a minute.' },
        429
      );
    }

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { success: false, message: 'Invalid JSON body. Expected { "websiteUrl": string }' },
        400
      );
    }

    if (!body || typeof body.websiteUrl !== 'string' || !body.websiteUrl.trim()) {
      return c.json(
        { success: false, message: 'Field "websiteUrl" is required and must be a valid URL string.' },
        400
      );
    }

    const { generateLlmsTxt } = await import('./llmsTxtGenerator.js');
    const result = await generateLlmsTxt(body.websiteUrl.trim());

    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof UrlCheckError) {
      return c.json({ success: false, message: error.message }, error.statusCode as any);
    }
    if (error instanceof UnsafeUrlError) {
      return c.json({ success: false, message: error.message }, 400);
    }
    logError('LLMS_TXT_GENERATE', error);
    return c.json(
      { success: false, message: error.message || 'Failed to generate llms.txt file.' },
      500
    );
  }
};
