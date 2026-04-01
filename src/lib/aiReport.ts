import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

const safeParseJson = (input: string) => {
  try {
    return JSON.parse(input);
  } catch {
    const start = input.indexOf("{");
    const end = input.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(input.slice(start, end + 1));
    } catch {
      return null;
    }
  }
};

export const generateFullReport = async (url: string, preview: any) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const prompt = `
You are a senior website auditor.

Website URL:
${url}

Preview scan data (JSON):
${JSON.stringify(preview)}

Return ONLY valid JSON with this exact shape:
{
  "executiveSummary": "string",
  "technicalAnalysis": "string",
  "seoImprovements": ["string"],
  "performanceImprovements": ["string"],
  "businessGrowthSuggestions": ["string"],
  "competitorStrategy": "string (optional)",
  "estimatedTrafficImpact": "string"
}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You generate concise, structured website audit reports strictly as JSON.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const text = res?.choices?.[0]?.message?.content || "{}";
  const parsed = safeParseJson(text);

  if (!parsed) {
    return {
      executiveSummary: "Report generation failed",
      technicalAnalysis: "",
      seoImprovements: [],
      performanceImprovements: [],
      businessGrowthSuggestions: [],
      estimatedTrafficImpact: "",
    };
  }

  return parsed;
};
