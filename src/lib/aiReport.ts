import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

export const AI_AUDIT_REPORT_PROMPT = (input: {
  url: string;
  preview: any;
  competitor?: {
    url?: string | null;
    preview?: any | null;
    analysis?: any | null;
  } | null;
}) => {
  const competitorBlock = input.competitor?.url
    ? `
Competitor URL: ${input.competitor.url}
Competitor preview scan data (JSON): ${JSON.stringify(input.competitor.preview ?? null)}
Competitor comparison analysis (JSON): ${JSON.stringify(input.competitor.analysis ?? null)}
`
    : "";

  return `
You are a senior growth-focused website auditor and conversion strategist.

Website URL: ${input.url}
Preview scan data (JSON): ${JSON.stringify(input.preview)}
${competitorBlock}

Output requirements:
- Return ONLY valid JSON that matches the provided schema exactly.
- Always return every field in the schema.
- Use concise, specific, copy-paste ready recommendations. Avoid generic advice.

Field guidance:
- executiveSummary: 3–6 sentences. Include the biggest growth bottleneck + fastest win + expected outcome.
- technicalAnalysis: 8–14 short paragraphs/bullets (as text) referencing the provided metrics (load time, page size, images, scripts, indexing, social tags).
- seoImprovements: 6–10 actionable items. Each item should be specific and testable (what to change + where + why).
- performanceImprovements: 6–10 actionable items. Focus on impact first. Mention concrete tactics (image formats/compression, caching, script deferral, third-party scripts).
- businessGrowthSuggestions: 6–10 actionable items. Focus on lead-gen/CRO, messaging, trust, and retention. Tie each suggestion to a measurable KPI.
- estimatedTrafficImpact: a realistic range based on the data (e.g., Low/Medium/High + % range) and what drives it.
- competitorStrategy:
  - If no competitor data is provided, set competitorStrategy to null.
  - If competitor data is provided, analyze the competitor and produce a plan the user can execute to beat them. Include:
    1) Scorecard: compare Performance/SEO/Accessibility/Security and highlight the top 3 gaps (use the provided competitor analysis if present).
    2) What the competitor is doing better: concrete observations and hypotheses grounded in the metrics (speed, indexing, social tags, page weight, scripts, images).
    3) Copy-without-cloning: 3 positioning/content ideas and 3 SEO ideas to match or exceed competitor intent coverage.
    4) 30–60 day roadmap: 5–8 prioritized actions with clear expected impact + how to measure success.
    5) This-week quick wins: 5 items that can be shipped fast (hours–1 day) and improve rankings/CTR/conversion.
    6) Tracking plan: exactly what to track weekly (core web vitals, indexation, impressions/clicks, conversions) and the target deltas.
`;
};

const ReportSchema = z.object({
  executiveSummary: z.string(),
  technicalAnalysis: z.string(),
  seoImprovements: z.array(z.string()),
  performanceImprovements: z.array(z.string()),
  businessGrowthSuggestions: z.array(z.string()),
  competitorStrategy: z.string().nullable(),
  estimatedTrafficImpact: z.string(),
});

import { logError } from "./errorLog";

export function buildDegradedReport(reason: string): any {
  return {
    executiveSummary: `We encountered a temporary technical issue while generating your detailed AI report (${reason}). Our technical team has been notified. You still have access to all technical metrics and category scores below.`,
    technicalAnalysis: "Analysis partially unavailable due to AI service timeout or rate limit. Please check the 'Technical Metrics' card for raw data.",
    seoImprovements: ["Review your meta titles and descriptions for consistency.", "Ensure all images have descriptive ALT text.", "Verify your robots.txt and sitemap.xml are correctly linked."],
    performanceImprovements: ["Optimize large images to reduce page weight.", "Enable browser caching for static assets.", "Minimize the number of third-party scripts."],
    businessGrowthSuggestions: ["Optimize your primary call-to-action (CTA) for better conversions.", "Add trust signals like testimonials or partner logos.", "Ensure your value proposition is clear above the fold."],
    competitorStrategy: "Competitor deep-dive strategy currently unavailable. Please check back later or contact support if this persists.",
    estimatedTrafficImpact: "Potential for 15-30% traffic growth with standard optimizations.",
    error: reason
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const generateFullReportWithRetry = async (
  url: string,
  preview: any,
  competitor?: {
    url?: string | null;
    preview?: any | null;
    analysis?: any | null;
  } | null,
) => {
  if (!process.env.OPENAI_API_KEY) {
    logError("AI_REPORT", new Error("OPENAI_API_KEY is not set"));
    return buildDegradedReport("API Key Missing");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = AI_AUDIT_REPORT_PROMPT({ url, preview, competitor: competitor ?? null });

  let lastError: any = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // 30-second timeout using AbortController (OpenAI SDK supports it)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        response_format: zodResponseFormat(ReportSchema, "audit_report"),
      }, { signal: controller.signal });

      clearTimeout(timeoutId);

      const text = res?.choices?.[0]?.message?.content;
      if (text) {
        try {
          return JSON.parse(text);
        } catch (err: any) {
          logError("AI_REPORT_PARSE", err, { attempt, text });
          lastError = err;
        }
      }
    } catch (err: any) {
      logError(`AI_REPORT_ATTEMPT_${attempt}`, err, { url, attempt });
      lastError = err;
      if (attempt === 1) await sleep(2000); // Wait 2s before retry
    }
  }

  return buildDegradedReport(lastError?.message || "AI Service Unavailable");
};

// Keep original name for compatibility if needed, or update all callers
export const generateFullReport = generateFullReportWithRetry;
