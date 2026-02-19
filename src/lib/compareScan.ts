export const compareScans = (site: any, competitor: any) => {
  if (!site || !competitor) return null;

  const actions: string[] = [];
  let summary = "";
  const scoreGap = competitor.overall - site.overall;

  // ===== SUMMARY =====
  if (scoreGap > 15) {
    summary = "Competitor significantly outranking you in SEO & performance";
  } else if (scoreGap > 5) {
    summary = "Competitor slightly ahead of your website";
  } else {
    summary = "You are competing closely with this competitor";
  }

  // ===== SEO GAP =====
  if (competitor.categories.seo > site.categories.seo) {
    actions.push(
      "Improve SEO structure (meta tags, headings, indexing)"
    );
  }

  // ===== SPEED GAP =====
  const siteSpeed = parseInt(site.metrics.loadTime);
  const compSpeed = parseInt(competitor.metrics.loadTime);

  if (compSpeed < siteSpeed) {
    actions.push(
      `Improve load speed (${site.metrics.loadTime} → under ${competitor.metrics.loadTime})`
    );
  }

  // ===== PAGE SIZE =====
  const siteSize = parseInt(site.metrics.pageSize);
  const compSize = parseInt(competitor.metrics.pageSize);

  if (compSize < siteSize) {
    actions.push(
      "Reduce page size using compression & optimized images"
    );
  }

  // ===== SOCIAL TAGS =====
  if (!site.social.ogTags && competitor.social.ogTags) {
    actions.push("Add OpenGraph tags like competitor for social ranking");
  }

  if (!site.social.ogImage && competitor.social.ogImage) {
    actions.push("Add OG image to improve social preview CTR");
  }

  if (!site.social.twitterTags && competitor.social.twitterTags) {
    actions.push("Add Twitter meta tags like competitor");
  }

  // ===== IMAGES ALT =====
  if (site.metrics.images > competitor.metrics.images) {
    actions.push("Optimize images and use modern formats (webp)");
  }

  // ===== INDEXING =====
  if (!site.indexing.robots && competitor.indexing.robots) {
    actions.push("Add robots.txt for better crawling control");
  }

  if (!site.indexing.sitemap && competitor.indexing.sitemap) {
    actions.push("Add sitemap.xml for faster indexing");
  }

  return {
    scoreGap,
    summary,
    actionItems: actions.slice(0, 8),
  };
};
