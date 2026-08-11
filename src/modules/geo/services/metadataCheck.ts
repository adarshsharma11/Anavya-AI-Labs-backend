import type { CheerioAPI } from "cheerio";

export interface MetadataCheckResult {
  openGraph: boolean;
  twitterCards: boolean;
}

export function checkMetadata($: CheerioAPI): MetadataCheckResult {
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");

  const openGraph = Boolean(
    (ogTitle && ogTitle.trim().length > 0) &&
    (ogDesc && ogDesc.trim().length > 0) &&
    (ogImage && ogImage.trim().length > 0)
  );

  const twitterTitle = $('meta[name="twitter:title"]').attr("content") ||
                       $('meta[property="twitter:title"]').attr("content");
  const twitterCard = $('meta[name="twitter:card"]').attr("content") ||
                      $('meta[property="twitter:card"]').attr("content");

  const twitterCards = Boolean(
    (twitterTitle && twitterTitle.trim().length > 0) &&
    (twitterCard && twitterCard.trim().length > 0)
  );

  return {
    openGraph,
    twitterCards
  };
}
