import OpenAI from "openai";
import { createBlogRepo, getBlogBySlugRepo } from "../modules/blogs/blogs.repository";
import { logError } from "../lib/errorLog";

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

export async function generateDailyBlogs(count = 5) {
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
    const prompt = `You are an expert SEO content writer for Anavya AI Labs (an AI website auditor tool).
Generate a high-quality, professional blog post about: "${topic}". 

Return ONLY a valid JSON object with the following fields:
{
  "title": "A catchy, SEO-friendly title",
  "excerpt": "A 2-sentence summary of the post",
  "slug": "url-safe-slug-based-on-title",
  "content": ["Paragraph 1", "Paragraph 2", "Paragraph 3", "Paragraph 4", "Paragraph 5"],
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

      const blog = await createBlogRepo({
        slug: finalSlug,
        title: parsed.title,
        excerpt: parsed.excerpt,
        category: parsed.category || "SEO & Performance",
        date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        readTime: parsed.readTime,
        image: `https://images.unsplash.com/photo-${Math.floor(Math.random() * 1000000000)}?w=800&q=80`,
        authorName: "Anavya AI",
        authorRole: "Content Generation Engine",
        authorAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${finalSlug}`,
        tags: parsed.tags || [],
        content: parsed.content || [],
      });
      
      blogs.push(blog);
    } catch (err) {
      logError("BLOG_GENERATOR", err, { topic });
    }
  }
  
  console.log(`✓ Generated ${blogs.length} blogs`);
  return blogs;
}
