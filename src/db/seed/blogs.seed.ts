import { db } from "../db";
import { blogs } from "../schema/blogs";

async function seedBlogs() {
  const existingBlogs = await db.query.blogs.findMany();
  if (existingBlogs.length > 0) {
    console.log("Blogs already exist. Skipping seed.");
    process.exit(0);
  }

  const data = [
    {
      slug: "understanding-core-web-vitals",
      title: "Understanding Core Web Vitals for Modern SEO",
      excerpt: "A deep dive into how Google's Core Web Vitals impact your search rankings and what you can do to optimize them.",
      category: "SEO",
      date: new Date().toISOString().substring(0, 10),
      readTime: "5 min read",
      image: "https://images.unsplash.com/photo-1432821596592-e2c18b78144f?auto=format&fit=crop&w=1200&q=80",
      authorName: "Anavya Team",
      authorRole: "Growth & SEO",
      authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Anavya",
      tags: ["SEO", "Performance", "Growth"],
      content: [
        "Core Web Vitals are a set of specific factors that Google considers important in a webpage's overall user experience.",
        "They consist of three specific page speed and user interaction measurements: largest contentful paint, first input delay, and cumulative layout shift.",
        "Improving these metrics not only helps with SEO but also directly impacts conversion rates."
      ]
    },
    {
      slug: "how-to-fix-broken-links",
      title: "How to Find and Fix Broken Links on Your Website",
      excerpt: "Broken links can hurt your SEO and user experience. Learn how to identify and resolve them quickly.",
      category: "Technical SEO",
      date: new Date().toISOString().substring(0, 10),
      readTime: "4 min read",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
      authorName: "Anavya Team",
      authorRole: "Technical Audit",
      authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=AnavyaTech",
      tags: ["Audit", "Links", "SEO"],
      content: [
        "A broken link, often known as a dead link, is a link on a web page that no longer works because the website is experiencing one or more issues.",
        "These issues can include the destination webpage being moved or deleted, or the URL being mistyped.",
        "Using tools like Anavya AI Labs, you can automatically scan your entire site for 404 errors and fix them before they impact your rankings."
      ]
    }
  ];

  await db.insert(blogs).values(data);
  console.log("Seeded default blogs.");
  process.exit(0);
}

seedBlogs();
