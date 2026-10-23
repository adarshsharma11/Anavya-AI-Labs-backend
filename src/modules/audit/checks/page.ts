import type { CheckResult } from "../types.js";
import { isQuestionHeading, type PageData } from "../extract.js";
import { notApplicable, passFail, scored, type CheckDef } from "./define.js";

const FACT_PATTERN =
  /\d+(\.\d+)?\s?(%|percent|x\b|million|billion|thousand|k\b|hours?|days?|minutes?|seconds?|ms\b)|[$₹€£]\s?\d|\b(19|20)\d{2}\b|\b\d{2,}\b/i;
const INSIGHT_PATTERN =
  /according to|\bstud(y|ies)\b|\bsurvey(ed)?\b|research (shows|found|from|by)|data (shows|from)|statistic|found that|analy[sz]is of \d|benchmark|case study/i;
const ORG_TYPES = ["Organization", "Corporation", "LocalBusiness", "ProfessionalService", "Person", "OnlineStore"];
const ARTICLE_TYPES = ["Article", "BlogPosting", "NewsArticle", "TechArticle", "Report"];

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const aeoChecks = (p: PageData): CheckResult[] => {
  const hasFaqSchema = p.schemaTypes.includes("FAQPage");
  const opening = p.openingParagraph.split(/\s+/).filter(Boolean).length;
  const questionHeadings = p.subheadings.filter(isQuestionHeading).length;
  const factual = p.paragraphs.filter((para) => FACT_PATTERN.test(para)).length;
  const hasHowTo = p.schemaTypes.includes("HowTo");

  return [
    passFail(
      { id: "faq_schema", category: "aeo", label: "FAQPage Schema Markup", maxPoints: 18, why: "FAQ schema hands AI engines ready-made question and answer pairs they can quote directly." },
      hasFaqSchema,
      hasFaqSchema ? "FAQPage structured data found on this page" : "No FAQPage structured data found",
      p.faqPairs > 0
        ? `You already have ${plural(p.faqPairs, "FAQ question")}. Wrap them in a FAQPage JSON-LD block (Google's Rich Results Test shows the format).`
        : "Add 4–6 real customer questions with short answers at the bottom of the page, and mark them up with FAQPage JSON-LD.",
    ),
    scored(
      { id: "direct_answer", category: "aeo", label: "Direct Answer in Opening Paragraph", maxPoints: 15, why: "AI engines prefer pages that answer the question immediately, without making the reader scroll first." },
      opening >= 50 ? 15 : opening >= 30 ? 8 : opening > 0 ? 2 : 0,
      opening ? `Opening paragraph: ${opening} words${opening < 50 ? ", too short (aim for 50 or more)" : ""}` : "No opening paragraph found",
      "Rewrite the first paragraph to answer the page's main question in 50–80 words, and include one concrete fact (a number, price, or timeframe).",
    ),
    scored(
      { id: "question_headings", category: "aeo", label: "Question-Based H2/H3 Headings", maxPoints: 15, why: "Question headings match exactly how people phrase queries to AI assistants." },
      questionHeadings >= 3 ? 15 : questionHeadings * 5,
      `${questionHeadings} question-based headings found out of ${p.subheadings.length} total subheadings`,
      `Change at least ${Math.max(3 - questionHeadings, 1)} of your H2/H3 headings to questions that start with "What", "How", "Why", "When", or "Is" (for example, "How much does it cost?").`,
    ),
    scored(
      { id: "factual_density", category: "aeo", label: "Answer Density: Factual Content", maxPoints: 12, why: "AI engines prefer to cite specific facts and numbers rather than vague, general statements." },
      factual >= 3 ? 12 : factual * 4,
      `${plural(factual, "paragraph")} contain statistics, data, or verifiable facts`,
      "Add concrete numbers to at least 3 paragraphs: results you achieved, prices, time saved, customer counts, or dated facts.",
    ),
    hasHowTo
      ? passFail({ id: "howto_schema", category: "aeo", label: "HowTo Schema Markup", maxPoints: 10, why: "HowTo schema makes your steps directly extractable for \"how to\" questions." }, true, "HowTo schema found", "")
      : p.orderedStepLists > 0
        ? passFail(
            { id: "howto_schema", category: "aeo", label: "HowTo Schema Markup", maxPoints: 10, why: "HowTo schema makes your steps directly extractable for \"how to\" questions." },
            false,
            "Step-by-step content found, but no HowTo schema",
            "Wrap your step-by-step list in a HowTo JSON-LD block, with one HowToStep per step.",
          )
        : notApplicable(
            { id: "howto_schema", category: "aeo", label: "HowTo Schema Markup", maxPoints: 10, why: "HowTo schema makes your steps directly extractable for \"how to\" questions." },
            "no step-by-step content on this page",
          ),
    scored(
      { id: "sentence_length", category: "aeo", label: "Readability: Average Sentence Length", maxPoints: 10, why: "Short, clear sentences are easier for AI to lift into an answer word for word." },
      !p.avgSentenceWords ? 0 : p.avgSentenceWords <= 20 ? 10 : p.avgSentenceWords <= 25 ? 6 : 2,
      p.avgSentenceWords
        ? `Average sentence length: ${p.avgSentenceWords} words${p.avgSentenceWords <= 20 ? ", excellent" : ", too long"}`
        : "Not enough paragraph text to measure",
      "Split long sentences so most are under 20 words. Aim for one idea per sentence.",
    ),
    passFail(
      { id: "faq_content", category: "aeo", label: "FAQ Section in Page Content", maxPoints: 8, why: "A visible FAQ section gives AI engines extra question-and-answer pairs to quote." },
      p.faqPairs >= 3,
      p.faqPairs ? `FAQ section detected (${p.faqPairs} Q&A pairs)` : "No FAQ section found",
      "Add a visible FAQ section with at least 3 questions your customers really ask.",
    ),
    scored(
      { id: "lists_tables", category: "aeo", label: "Structured Lists and Tables", maxPoints: 7, why: "Lists and tables are the formats AI engines most often lift into answers." },
      p.listItems >= 5 || p.tables > 0 ? 7 : p.listItems > 0 ? 3 : 0,
      `${p.listItems} list items and ${p.tables} tables found`,
      "Turn key information (features, steps, pricing, comparisons) into bullet lists or a simple table.",
    ),
    scored(
      { id: "aeo_word_count", category: "aeo", label: "Content Depth: Word Count", maxPoints: 5, why: "Pages with more depth give AI more passages to choose from when answering." },
      p.wordCount >= 800 ? 5 : p.wordCount >= 400 ? 2 : 0,
      `${p.wordCount} words${p.wordCount < 400 ? ", very thin content" : ""}`,
      "Expand the page to at least 800 words that answer the questions your customers ask.",
    ),
  ];
};

const geoChecks = (p: PageData): CheckResult[] => {
  const isArticle = p.pageType === "article";
  const entityNodes = p.schema
    .filter((n) => n.types.some((t) => ORG_TYPES.includes(t)) && typeof n.data.name === "string")
    .sort((a, b) => Number(Boolean(b.data.sameAs)) - Number(Boolean(a.data.sameAs)) || Number(b.types.includes("Organization")) - Number(a.types.includes("Organization")));
  const orgNode = entityNodes[0];
  const orgName = typeof orgNode?.data.name === "string" ? orgNode.data.name : "";
  const sameAs = orgNode?.data.sameAs;
  const sameAsCount = Array.isArray(sameAs) ? sameAs.length : typeof sameAs === "string" ? 1 : 0;
  const insights = p.paragraphs.filter((para) => INSIGHT_PATTERN.test(para)).length;
  const external = p.externalHosts.length;
  const dateValue = p.modifiedAt || p.publishedAt;
  const ageDays = dateValue ? (Date.now() - new Date(dateValue).getTime()) / 86_400_000 : NaN;
  const hasArticleSchema = p.schemaTypes.some((t) => ARTICLE_TYPES.includes(t));

  const freshnessDef: CheckDef = { id: "freshness", category: "geo", label: "Content Freshness", maxPoints: 15, why: "AI engines favour recently updated content when answering questions about current information." };
  const authorDef: CheckDef = { id: "author", category: "geo", label: "Author Attribution", maxPoints: 10, why: "A named author with credentials is a key trust (E-E-A-T) signal for AI citations." };
  const articleDef: CheckDef = { id: "article_schema", category: "geo", label: "Article-Type Schema", maxPoints: 8, why: "Article schema tells AI engines who wrote the piece and when, which makes it safer to cite." };

  return [
    !isArticle
      ? notApplicable(freshnessDef, `publication dates are not expected on ${p.pageType} pages`)
      : scored(
          freshnessDef,
          Number.isNaN(ageDays) ? 0 : ageDays <= 365 ? 15 : ageDays <= 730 ? 8 : 2,
          Number.isNaN(ageDays) ? "No published or modified date found" : `Last updated ${Math.round(ageDays)} days ago`,
          "Show a visible \"Last updated\" date and add dateModified to your Article schema. Review this page at least once a year.",
        ),
    scored(
      { id: "entity_clarity", category: "geo", label: "Entity Clarity", maxPoints: 12, why: "Clear named entities help AI systems understand who the page is about and link it to your brand." },
      (orgName ? 6 : 0) + (sameAsCount > 0 ? 6 : 0),
      orgName
        ? `Organization "${orgName}" defined with ${plural(sameAsCount, "sameAs profile link")}`
        : "No Organization or Person schema with a name found",
      orgName
        ? "Add a sameAs list to your Organization schema linking to your LinkedIn, X, Crunchbase, and Google Business profiles."
        : "Add Organization JSON-LD with your exact brand name, logo, and url, plus sameAs links to your social profiles.",
    ),
    scored(
      { id: "insight_signals", category: "geo", label: "Unique Insight Signals", maxPoints: 12, why: "Data-backed insights make content more citable and trustworthy in AI-generated answers." },
      insights >= 2 ? 12 : insights * 6,
      `${plural(insights, "paragraph")} include stats or research cues`,
      "Add original data or cite research: \"In our audit of 200 sites…\", \"According to Google's 2025 report…\".",
    ),
    scored(
      { id: "external_citations", category: "geo", label: "External Source Citations", maxPoints: 10, why: "Linking to trusted sources shows your claims are verifiable, which AI engines reward." },
      external >= 3 ? 10 : external * 2,
      `${plural(external, "external site")} linked`,
      `Link to ${Math.max(3 - external, 1)} more authoritative sources (official docs, studies, industry reports) where you make claims.`,
    ),
    !isArticle
      ? notApplicable(authorDef, `author attribution is not expected on ${p.pageType} pages`)
      : passFail(
          authorDef,
          Boolean(p.author),
          p.author ? `Author: ${p.author}` : "No author found",
          "Show the author's name and a 1-line bio on the page, and add an author property to your Article schema.",
        ),
    !isArticle
      ? notApplicable(articleDef, `Article schema is for editorial content, not ${p.pageType} pages`)
      : passFail(
          articleDef,
          hasArticleSchema,
          hasArticleSchema ? "Article schema found" : "No Article or BlogPosting schema found",
          "Add BlogPosting JSON-LD with headline, author, datePublished, dateModified, and image.",
        ),
  ];
};

const technicalChecks = (p: PageData): CheckResult[] => {
  const titleLen = p.title.length;
  const descLen = p.metaDescription.length;
  const singleH1 = p.h1.length === 1;
  const altPct = pct(p.imagesWithAlt, p.images);
  const internal = p.internalLinks.length;

  return [
    passFail(
      { id: "https", category: "technical", label: "HTTPS", maxPoints: 10, why: "Search engines and AI tools trust and rank secure pages above insecure ones." },
      p.isHttps,
      p.isHttps ? "Page served over HTTPS" : "Page is not served over HTTPS",
      "Install a free SSL certificate (for example Let's Encrypt or Cloudflare) and redirect all http:// traffic to https://.",
    ),
    passFail(
      { id: "noindex", category: "technical", label: "Indexable Page", maxPoints: 10, why: "A noindex tag hides the page from search engines and AI answers entirely." },
      !p.noindex,
      p.noindex ? "Page has a noindex robots directive" : "Page can be indexed",
      "Remove \"noindex\" from the robots meta tag (or from the X-Robots-Tag header) on this page.",
    ),
    passFail(
      { id: "viewport", category: "technical", label: "Mobile Viewport Meta Tag", maxPoints: 8, why: "Google indexes the mobile version first, and pages without a viewport tag render badly on phones." },
      p.viewport,
      p.viewport ? "Viewport meta tag found" : "No viewport meta tag",
      "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> inside <head>.",
    ),
    scored(
      { id: "title_length", category: "technical", label: "Title Length (40-65 chars)", maxPoints: 10, why: "The title is the first thing search engines and AI read to decide what the page is about." },
      titleLen >= 40 && titleLen <= 65 ? 10 : titleLen > 0 ? 5 : 0,
      titleLen ? `Title length: ${titleLen} characters` : "No title tag",
      titleLen
        ? `Rewrite the title to 40–65 characters (it is ${titleLen} now): main keyword first, brand last.`
        : "Add a <title> of 40–65 characters: main keyword first, brand last.",
    ),
    scored(
      { id: "meta_description", category: "technical", label: "Meta Description Length (120-160 chars)", maxPoints: 10, why: "AI engines use the meta description to understand the page's purpose and decide whether to cite it." },
      descLen >= 120 && descLen <= 160 ? 10 : descLen > 0 ? 4 : 0,
      descLen ? `Meta description length: ${descLen} characters` : "No meta description",
      descLen
        ? `Rewrite the meta description to 120–160 characters (it is ${descLen} now) and say clearly what the page answers.`
        : "Add a 120–160 character meta description summarising what the page answers.",
    ),
    passFail(
      { id: "canonical", category: "technical", label: "Canonical Tag", maxPoints: 8, why: "A canonical tag prevents duplicate versions of the page from splitting your ranking." },
      Boolean(p.canonical),
      p.canonical ? `Canonical: ${p.canonical}` : "No canonical tag",
      `Add <link rel="canonical" href="${p.url}"> inside <head>.`,
    ),
    passFail(
      { id: "open_graph", category: "technical", label: "Open Graph Core Tags", maxPoints: 8, why: "Open Graph tags control how your page looks when it is shared and summarised." },
      Boolean(p.og.title && p.og.description),
      p.og.title && p.og.description ? "og:title and og:description found" : "og:title or og:description missing",
      "Add og:title, og:description, and og:image meta tags (most CMS SEO plugins do this automatically).",
    ),
    scored(
      { id: "alt_coverage", category: "technical", label: "Image Alt Text Coverage", maxPoints: 8, why: "Alt text is how crawlers and AI understand your images." },
      p.images === 0 ? 8 : Math.round((altPct / 100) * 8),
      p.images ? `${p.imagesWithAlt}/${p.images} images with alt text` : "No images on the page",
      `Add descriptive alt text to the ${p.images - p.imagesWithAlt} images that are missing it.`,
    ),
    scored(
      { id: "internal_links", category: "technical", label: "Internal Linking", maxPoints: 8, why: "Internal links help crawlers discover your pages and understand how they relate." },
      internal >= 10 ? 8 : internal >= 3 ? 4 : 0,
      `${plural(internal, "internal link")} found`,
      "Link to at least 10 related pages on your site (services, blog posts, About, Contact) using descriptive anchor text.",
    ),
    passFail(
      { id: "single_h1", category: "technical", label: "Single H1", maxPoints: 8, why: "One clear H1 tells crawlers the single main topic of the page." },
      singleH1,
      `${p.h1.length} H1 headings found`,
      p.h1.length === 0 ? "Add one H1 heading that states the page's main topic." : "Keep exactly one H1 and change the others to H2.",
    ),
    scored(
      { id: "page_size", category: "technical", label: "Page Size", maxPoints: 7, why: "Lighter HTML loads faster and is crawled more completely." },
      p.sizeKB <= 100 ? 7 : p.sizeKB <= 300 ? 4 : 0,
      `${p.sizeKB} KB HTML payload`,
      "Reduce the HTML size: remove inline scripts and styles, unused markup, and large embedded data.",
    ),
  ];
};

const contentChecks = (p: PageData): CheckResult[] => {
  const needsByline = p.pageType === "article";
  const eeatParts = [
    needsByline ? (p.author ? 5 : 0) : 5,
    needsByline ? (p.publishedAt || p.modifiedAt ? 5 : 0) : 5,
    p.externalHosts.length >= 3 ? 5 : 0,
    p.hasAboutOrContactLink ? 5 : 0,
  ];
  const eeatEvidence = [
    needsByline ? `Author: ${p.author || "missing"}` : "Author: not required for this page type",
    needsByline ? `Date: ${p.publishedAt || p.modifiedAt || "missing"}` : "Date: not required for this page type",
    p.externalHosts.length >= 3 ? `${p.externalHosts.length} external links` : `Only ${p.externalHosts.length} external links (need 3+)`,
    p.hasAboutOrContactLink ? "About/Contact links found" : "No About/Contact links",
  ].join(" | ");
  const altPct = pct(p.imagesWithAlt, p.images);
  const internal = p.internalLinks.length;

  return [
    scored(
      { id: "word_count", category: "content", label: "Word Count", maxPoints: 20, why: "Longer, comprehensive pages give AI more quotable passages and signal topical authority." },
      p.wordCount >= 800 ? 20 : p.wordCount >= 500 ? 10 : 0,
      `${p.wordCount} words`,
      `Expand this page to at least 800 words (it has ${p.wordCount}). Cover the topic thoroughly with facts, examples, and an FAQ.`,
    ),
    scored(
      { id: "heading_structure", category: "content", label: "Heading Structure", maxPoints: 20, why: "A clear heading outline lets AI jump straight to the section that answers a question." },
      p.h1.length === 1 && p.h2Count >= 2 ? 20 : p.h2Count >= 1 ? 10 : 0,
      `H1: ${p.h1.length}, H2: ${p.h2Count}, H3: ${p.h3Count}`,
      "Use one H1, then break the content into sections with at least 2–3 H2 headings (and H3s inside them).",
    ),
    scored(
      { id: "eeat", category: "content", label: "E-E-A-T Signals", maxPoints: 20, why: "Experience, expertise, authority and trust signals decide whether AI considers you a safe source." },
      eeatParts.reduce((a, b) => a + b, 0),
      eeatEvidence,
      "Strengthen trust: link to About and Contact pages, cite 3+ external sources, and show an author and date on articles.",
    ),
    scored(
      { id: "images_alt", category: "content", label: "Images and Alt Text", maxPoints: 15, why: "Relevant images with alt text make pages richer and give AI more context." },
      p.images === 0 ? 7 : Math.round((altPct / 100) * 15),
      p.images ? `${p.imagesWithAlt}/${p.images} images with alt` : "No images found",
      p.images ? "Add descriptive alt text to every meaningful image." : "Add at least one relevant image (a diagram, screenshot, or photo) with descriptive alt text.",
    ),
    scored(
      { id: "content_internal_links", category: "content", label: "Internal Linking", maxPoints: 10, why: "Linking related content builds topical authority across your site." },
      internal >= 10 ? 10 : internal >= 3 ? 5 : 0,
      `${plural(internal, "internal link")} found`,
      "Link this page to related services, guides, and blog posts on your site.",
    ),
    passFail(
      { id: "lang_tag", category: "content", label: "Language Tag", maxPoints: 8, why: "The lang attribute tells AI which language and audience the content serves." },
      Boolean(p.lang),
      p.lang ? `lang="${p.lang}"` : "No lang attribute on <html>",
      "Add a lang attribute to the html tag, for example <html lang=\"en\">.",
    ),
    passFail(
      { id: "social_tags", category: "content", label: "Social Tags", maxPoints: 7, why: "Social tags make your content display well wherever it is shared or summarised." },
      Boolean(p.og.title && p.twitterCard),
      `og:title: ${p.og.title ? "yes" : "no"}, twitter:card: ${p.twitterCard ? "yes" : "no"}`,
      "Add og:title, og:image, and twitter:card (summary_large_image) meta tags.",
    ),
  ];
};

export function runPageChecks(page: PageData): CheckResult[] {
  return [...aeoChecks(page), ...geoChecks(page), ...technicalChecks(page), ...contentChecks(page)];
}
