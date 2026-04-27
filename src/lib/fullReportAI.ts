import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Zod Schema for Structured Output
const CodeSnippetSchema = z.object({
  html: z.string().optional().describe("Ready-to-use HTML fix/snippet"),
  css: z.string().optional().describe("Ready-to-use CSS fix/snippet"),
  js: z.string().optional().describe("Ready-to-use Javascript fix/snippet")
});

const IssueSchema = z.object({
  title: z.string(),
  severity: z.string(),
  suggestion: z.string(),
  codeSnippet: CodeSnippetSchema.optional()
});

const FullReportSchema = z.object({
  issues: z.array(IssueSchema),
  suggestions: z.array(z.string()),
  summary: z.string()
});

export const generateFullReportAI = async (url: string, preview: any) => {
  const prompt = `
You are a senior website auditor.
Analyze this website: ${url}
Current metrics: ${JSON.stringify(preview)}

Your goal is not just to identify issues, but to provide copy-paste ready HTML, CSS, and Javascript code snippets to fix those EXACT issues. If an issue doesn't need code, omit the code snippet.
Return exactly the structure defined by the JSON Schema.
`;

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
    console.error("AI report generation failed", error);
  }

  return {
    issues: [],
    suggestions: ["AI report generation failed"],
    summary: "Error generating report",
  };
};
