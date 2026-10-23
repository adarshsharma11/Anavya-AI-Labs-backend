import OpenAI from "openai";
import { createBlogRepo, getBlogBySlugRepo } from "../modules/blogs/blogs.repository.js";
import { logError } from "../lib/errorLog.js";

const BLOG_TOPICS = [
  "Why your website loads slowly: Performance audit secrets",
  "SEO checklist: 10 critical tags that kill your rankings",
  "Competitor analysis: How to beat #1 ranking websites",
  "Core Web Vitals 2025: What Google really measures",
  "Mobile-first indexing: Is your site losing traffic?",
  "How AI is revolutionizing technical SEO in 2026",
  "The true cost of poor accessibility for your business",
  "Lead generation hacks: Turning audit reports into sales",
  "Website security 101: Essential hardening for small business",
  "The psychology of page speed: How 1 second costs millions"
];

const BLOG_IMAGES = [
  "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80",
];

export async function generateDailyBlogs(count = 2) {
  if (!process.env.OPENAI_API_KEY) {
    logError("BLOG_GENERATOR", new Error("OPENAI_API_KEY is not set"));
    return [];
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const blogs = [];
  
  // Pick random topics to avoid exact duplicates every 2 days
  const shuffled = [...BLOG_TOPICS].sort(() => 0.5 - Math.random());
  const selectedTopics = shuffled.slice(0, count);

  for (const topic of selectedTopics) {
    const prompt = `You are an expert SEO and GEO (Generative Engine Optimization) content writer for Anavya AI Labs (an AI website auditor tool).
Generate a high-quality, professional blog post about: "${topic}". 

The blog post must be optimized for both Google SEO and LLM-based search engines (like ChatGPT Search, Gemini, Perplexity) using GEO best practices:
1. Direct Answer Format: Answer the core topic query directly in the first two paragraphs so LLM models can easily retrieve it as a direct quote.
2. High Information Density: Structure content with clear markdown headings (### and ####).
3. Structured Data: Include at least one comparative Markdown Table or a numbered Checklist.
4. AI Summary: Include a dedicated key-takeaway Markdown Blockquote or Callout section.

Return ONLY a valid JSON object with the following fields:
{
  "title": "A catchy, SEO & GEO optimized title",
  "excerpt": "A 2-sentence summary of the post",
  "slug": "url-safe-slug-based-on-title",
  "content": "Raw MDX string containing the complete formatted post with markdown headings, bold terms, blockquotes, and tables",
  "category": "One of: SEO, Performance, Growth, Security",
  "tags": ["3-5 relevant keywords"],
  "readTime": "e.g., 5 min read"
}

Maintain a helpful, authoritative tone.`;

    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      
      const text = res.choices?.[0]?.message?.content;
      if (!text) continue;

      const parsed = JSON.parse(text);
      
      // Ensure unique slug
      let finalSlug = parsed.slug;
      const existing = await getBlogBySlugRepo(finalSlug);
      if (existing) {
        finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
      }

      // Handle content if it is returned as array or string
      const contentStr = Array.isArray(parsed.content) 
        ? parsed.content.join("\n\n") 
        : (parsed.content || "");

      const blog = await createBlogRepo({
        slug: finalSlug,
        title: parsed.title,
        excerpt: parsed.excerpt,
        category: parsed.category || "SEO & Performance",
        date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        readTime: parsed.readTime,
        image: BLOG_IMAGES[Math.floor(Math.random() * BLOG_IMAGES.length)],
        authorName: "Anavya AI",
        authorRole: "Content Generation Engine",
        authorAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${finalSlug}`,
        tags: parsed.tags || [],
        content: contentStr,
        status: "draft",
      });
      
      blogs.push(blog);
    } catch (err) {
      logError("BLOG_GENERATOR", err, { topic });
    }
  }
  
  console.log(`✓ Generated ${blogs.length} draft blogs for review`);
  return blogs;
}
