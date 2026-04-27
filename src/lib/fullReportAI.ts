import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

export const AI_CODE_FIX_REPORT_PROMPT = (input: { url: string; preview: any }) => {
  return `
You are a senior website auditor and performance/SEO engineer.

Website URL: ${input.url}
Preview scan data (JSON): ${JSON.stringify(input.preview)}

Output requirements:
- Return ONLY valid JSON that matches the provided schema exactly.
- Always include every field in the schema; use null for fields that do not apply.
- Focus on high-impact, real-world fixes that are feasible for a typical production site.

Guidance:
- issues: include the most impactful problems first. For each issue, make the suggestion specific and actionable.
- codeSnippet: when code is relevant, provide minimal, copy-paste ready snippets. If not relevant, set codeSnippet to null (not omitted).
`;
};

// Zod Schema for Structured Output
const CodeSnippetSchema = z.object({
  html: z.string().nullable().describe("Ready-to-use HTML fix/snippet"),
  css: z.string().nullable().describe("Ready-to-use CSS fix/snippet"),
  js: z.string().nullable().describe("Ready-to-use Javascript fix/snippet"),
});

const IssueSchema = z.object({
  title: z.string(),
  severity: z.string(),
  suggestion: z.string(),
  codeSnippet: CodeSnippetSchema.nullable(),
});

const FullReportSchema = z.object({
  issues: z.array(IssueSchema),
  suggestions: z.array(z.string()),
  summary: z.string()
});

export const generateFullReportAI = async (url: string, preview: any) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = AI_CODE_FIX_REPORT_PROMPT({ url, preview });

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      response_format: zodResponseFormat(FullReportSchema, "full_report"),
    });

    const text = res?.choices[0]?.message.content;
    if (text) {
      return JSON.parse(text);
    }
  } catch (error) {
  }

  return {
    issues: [],
    suggestions: ["AI report generation failed"],
    summary: "Error generating report",
  };
};
