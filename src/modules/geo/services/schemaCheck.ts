import type { CheerioAPI } from "cheerio";

export interface SchemaResult {
  types: string[];
  hasSchema: boolean;
}

const TARGET_SCHEMAS = [
  "Article",
  "FAQPage",
  "HowTo",
  "Product",
  "Organization",
  "Person",
  "LocalBusiness",
  "Review",
  "BreadcrumbList",
  "VideoObject"
];

export function checkSchema($: CheerioAPI): SchemaResult {
  const detectedTypesSet = new Set<string>();

  try {
    $('script[type="application/ld+json"]').each((_, element) => {
      const text = $(element).html();
      if (!text) return;

      try {
        const parsed = JSON.parse(text.trim());
        extractTypes(parsed, detectedTypesSet);
      } catch {
        // Skip invalid JSON-LD blocks
      }
    });
  } catch {
    // Fail-safe
  }

  const detectedTypes = Array.from(detectedTypesSet).filter(type => 
    TARGET_SCHEMAS.some(t => t.toLowerCase() === type.toLowerCase())
  );

  // Map to original casing in TARGET_SCHEMAS
  const types = detectedTypes.map(d => 
    TARGET_SCHEMAS.find(t => t.toLowerCase() === d.toLowerCase()) || d
  );

  return {
    types,
    hasSchema: types.length > 0
  };
}

function extractTypes(obj: any, set: Set<string>) {
  if (!obj) return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractTypes(item, set);
    }
    return;
  }

  if (typeof obj === "object") {
    // Check if it has @type parameter
    if (typeof obj["@type"] === "string") {
      set.add(obj["@type"]);
    } else if (Array.isArray(obj["@type"])) {
      for (const t of obj["@type"]) {
        if (typeof t === "string") set.add(t);
      }
    }

    // Recursively check all nested properties (e.g. graph sub-elements)
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === "object") {
        extractTypes(obj[key], set);
      }
    }
  }
}
