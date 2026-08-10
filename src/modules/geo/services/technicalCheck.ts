import type { CheerioAPI } from "cheerio";

export interface TechnicalResult {
  viewport: boolean;
  charset: boolean;
  indexable: boolean;
}

export function checkTechnical($: CheerioAPI, xRobotsHeader?: string): TechnicalResult {
  const viewportTag = $('meta[name="viewport"]').attr("content");
  const viewport = Boolean(viewportTag && viewportTag.trim().length > 0);

  const charsetAttr = $('meta[charset]').attr("charset");
  const httpEquivContent = $('meta[http-equiv="content-type"]').attr("content") || 
                           $('meta[http-equiv="Content-Type"]').attr("content");
  const hasCharsetInHttpEquiv = Boolean(httpEquivContent && httpEquivContent.toLowerCase().includes("charset"));
  const charset = Boolean((charsetAttr && charsetAttr.trim().length > 0) || hasCharsetInHttpEquiv);

  // Indexability check
  const robotsMeta = $('meta[name="robots"]').attr("content");
  let indexable = true;

  if (robotsMeta && (robotsMeta.toLowerCase().includes("noindex") || robotsMeta.toLowerCase().includes("none"))) {
    indexable = false;
  }

  if (xRobotsHeader && (xRobotsHeader.toLowerCase().includes("noindex") || xRobotsHeader.toLowerCase().includes("none"))) {
    indexable = false;
  }

  return {
    viewport,
    charset,
    indexable
  };
}
