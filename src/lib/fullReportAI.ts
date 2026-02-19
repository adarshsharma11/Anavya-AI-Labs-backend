import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const generateFullReportAI = async (url: string, preview: any) => {
  const prompt = `
You are a senior website auditor.

Analyze this website:
${url}

Current metrics:
${JSON.stringify(preview)}

Return JSON:
{
 issues:[{title,severity,suggestion}],
 suggestions:[string],
 summary:string
}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
  });

  const text = res?.choices[0]?.message.content || "{}";

  try {
    return JSON.parse(text);
  } catch {
    return {
      issues: [],
      suggestions: ["AI report generation failed"],
      summary: "Error generating report",
    };
  }
};
