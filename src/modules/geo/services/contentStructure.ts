import type { CheerioAPI } from "cheerio";

export interface ContentStructureResult {
  h1Count: number;
  hasMetaDescription: boolean;
  hasAuthor: boolean;
  hasPublishedDate: boolean;
  hasModifiedDate: boolean;
  canonical: boolean;
}

export function checkContentStructure($: CheerioAPI): ContentStructureResult {
  const h1Count = $("h1").length;

  const metaDesc = $('meta[name="description"]').attr("content") || 
                    $('meta[property="og:description"]').attr("content");
  const hasMetaDescription = Boolean(metaDesc && metaDesc.trim().length > 0);

  // Checks for author tags
  const author = $('meta[name="author"]').attr("content") || 
                 $('[itemprop="author"]').text() ||
                 $('meta[property="article:author"]').attr("content");
  const hasAuthor = Boolean(author && author.trim().length > 0);

  // Checks for publication/modification dates
  const publishedDate = $('meta[property="article:published_time"]').attr("content") ||
                        $('meta[name="publish-date"]').attr("content") ||
                        $('meta[name="dateVal"]').attr("content") ||
                        $('time[datetime]').attr("datetime");
  const hasPublishedDate = Boolean(publishedDate && publishedDate.trim().length > 0);

  const modifiedDate = $('meta[property="article:modified_time"]').attr("content") ||
                       $('meta[name="last-modified"]').attr("content") ||
                       $('meta[name="revised"]').attr("content");
  const hasModifiedDate = Boolean(modifiedDate && modifiedDate.trim().length > 0);

  const canonicalUrl = $('link[rel="canonical"]').attr("href");
  const canonical = Boolean(canonicalUrl && canonicalUrl.trim().length > 0);

  return {
    h1Count,
    hasMetaDescription,
    hasAuthor,
    hasPublishedDate,
    hasModifiedDate,
    canonical
  };
}
