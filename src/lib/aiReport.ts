import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

const ReportSchema = z.object({
  executiveSummary: z.string(),
  technicalAnalysis: z.string(),
  seoImprovements: z.array(z.string()),
  performanceImprovements: z.array(z.string()),
  businessGrowthSuggestions: z.array(z.string()),
  competitorStrategy: z.string().optional(),
  estimatedTrafficImpact: z.string()
});

export const generateFullReport = async (url: string, preview: any) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const prompt = `
You are a senior website auditor.
Website URL: ${url}
Preview scan data (JSON): ${JSON.stringify(preview)}

Provide a highly structured actionable audit based on the metrics.
`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: zodResponseFormat(ReportSchema, "audit_report"),
    });

    const text = res?.choices?.[0]?.message?.content;
    if (text) {
      return JSON.parse(text);
    }
  } catch (err: any) {
    console.error("aiReport Error", err);
  }

  return {
    executiveSummary: "Report generation failed",
    technicalAnalysis: "",
    seoImprovements: [],
    performanceImprovements: [],
    businessGrowthSuggestions: [],
    estimatedTrafficImpact: "",
  };
};
