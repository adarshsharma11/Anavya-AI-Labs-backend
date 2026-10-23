import axios from "axios";
import { safeRedirects } from "../../lib/safeUrl.js";

const MAX_BYTES = 3 * 1024 * 1024;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
};

export interface FetchedResource {
  readonly ok: boolean;
  readonly status: number;
  readonly url: string;
  readonly finalUrl: string;
  readonly body: string;
  readonly contentType: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly elapsedMs: number;
}

export async function fetchResource(url: string, timeoutMs = 8000): Promise<FetchedResource> {
  const started = Date.now();
  try {
    const res = await axios.get(url, {
      ...safeRedirects,
      timeout: timeoutMs,
      headers: HEADERS,
      responseType: "text",
      transformResponse: (data) => data,
      maxContentLength: MAX_BYTES,
      validateStatus: () => true,
    });
    const headers = Object.fromEntries(
      Object.entries(res.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)]),
    );
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      url,
      finalUrl: res.request?.res?.responseUrl ?? url,
      body: typeof res.data === "string" ? res.data : "",
      contentType: headers["content-type"] ?? "",
      headers,
      elapsedMs: Date.now() - started,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      url,
      finalUrl: url,
      body: "",
      contentType: "",
      headers: {},
      elapsedMs: Date.now() - started,
    };
  }
}

/** Many SPAs answer every path with their HTML shell, so a 200 alone does not prove a text file exists. */
export const isRealTextFile = (res: FetchedResource) =>
  res.ok &&
  res.body.trim().length > 0 &&
  !/text\/html/i.test(res.contentType) &&
  !/^\s*<(!doctype|html)/i.test(res.body);

export const isHtml = (res: FetchedResource) =>
  res.ok && (/html/i.test(res.contentType) || /^\s*<(!doctype|html)/i.test(res.body));
