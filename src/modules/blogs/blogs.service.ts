import {
  getBlogsRepo,
  getBlogBySlugRepo,
  createBlogRepo,
  updateBlogRepo,
  deleteBlogRepo,
} from "./blogs.repository";

export const getBlogsService = async () => {
  const blogs = await getBlogsRepo();
  
  if (!blogs || blogs.length === 0) {
    return [
      {
        id: -1,
        slug: "understanding-core-web-vitals",
        title: "Understanding Core Web Vitals for Modern SEO",
        excerpt: "A deep dive into how Google's Core Web Vitals impact your search rankings and what you can do to optimize them.",
        category: "SEO",
        date: new Date().toISOString().split('T')[0],
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
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: -2,
        slug: "how-to-fix-broken-links",
        title: "How to Find and Fix Broken Links on Your Website",
        excerpt: "Broken links can hurt your SEO and user experience. Learn how to identify and resolve them quickly.",
        category: "Technical SEO",
        date: new Date().toISOString().split('T')[0],
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
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];
  }
  
  return blogs;
};

export const getBlogBySlugService = async (slug: string) => {
  return await getBlogBySlugRepo(slug);
};

export const createBlogService = async (data: any) => {
  return await createBlogRepo(data);
};

export const updateBlogService = async (slug: string, data: any) => {
  return await updateBlogRepo(slug, data);
};

export const deleteBlogService = async (slug: string) => {
  return await deleteBlogRepo(slug);
};
