import type { CheerioAPI } from "cheerio";

export interface ReadabilityResult {
  paragraphLength: number; // average paragraph length in words
  headingCount: number;
  bulletLists: number;
  tables: number;
  faqSection: boolean;
}

export function checkReadability($: CheerioAPI): ReadabilityResult {
  const headings = $("h1, h2, h3, h4, h5, h6");
  const headingCount = headings.length;

  const bulletLists = $("ul, ol").length;
  const tables = $("table").length;

  // Estimate paragraph lengths (average word count per paragraph)
  const paragraphs = $("p");
  let totalWords = 0;
  let pCount = 0;

  paragraphs.each((_, el) => {
    const text = $(el).text().trim();
    if (text) {
      const words = text.split(/\s+/).filter(Boolean).length;
      if (words >= 4) {
        totalWords += words;
        pCount++;
      }
    }
  });

  const paragraphLength = pCount > 0 ? Math.round(totalWords / pCount) : 0;

  // Determine if FAQ section exists by scanning heading titles or elements
  let faqSection = false;
  headings.each((_, el) => {
    const text = $(el).text().toLowerCase();
    if (text.includes("faq") || text.includes("frequently asked")) {
      faqSection = true;
    }
  });

  // Also check if any element has class/id related to FAQ
  if (!faqSection) {
    $("[id*='faq' i], [class*='faq' i]").each((_, el) => {
      faqSection = true;
    });
  }

  return {
    paragraphLength,
    headingCount,
    bulletLists,
    tables,
    faqSection
  };
}
