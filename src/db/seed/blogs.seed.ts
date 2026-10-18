import { db } from "../db.js";
import { blogs } from "../schema/blogs.js";

const author = {
  authorName: "Anavya AI Labs",
  authorRole: "SEO & GEO",
  authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=Anavya",
};

export const fallbackBlogsData = [
  {
    slug: "why-chatgpt-and-perplexity-dont-cite-your-website",
    title: "Why ChatGPT and Perplexity Don't Cite Your Website",
    excerpt:
      "Answer engines skip brands they cannot quote. Here is the generative engine optimization checklist that gets your pages retrieved, cited, and clicked.",
    category: "GEO",
    date: "October 19, 2026",
    readTime: "8 min read",
    image:
      "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1600&q=80",
    ...author,
    tags: [
      "generative engine optimization",
      "llms.txt",
      "AI search citations",
      "Perplexity SEO",
      "ChatGPT search",
    ],
    content: `ChatGPT, Perplexity, and Gemini cite the page that answers the question in the first two paragraphs, with a clear heading, a source they are allowed to crawl, and a fact they can quote without guessing. If your site is missing from those answers, the usual cause is not "the model dislikes your brand." The crawler never saw a page it could lift a sentence from.

That is the traffic problem in 2026. People still search, but a growing share of those searches end inside an answer box. You do not lose the ranking you can see in Google. You lose the citation you never earned.

## What an answer engine actually needs

An answer engine does three things before it mentions you:

1. It fetches a URL its crawler is allowed to read.
2. It finds a passage that directly answers the query.
3. It checks that the passage is specific enough to quote: a number, a definition, a step, or a comparison.

A homepage that says "we help businesses grow" fails all three. A guide that opens with the definition, then a table, then the steps, gets retrieved.

> **Direct answer:** Generative engine optimization (GEO) is the work of making pages extractable. You write the answer first, allow the crawlers, and give the model a sentence it can repeat without rewriting your whole site.

![A network of connected points, the way answer engines retrieve one page out of many](https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1400&q=80)

## The five blocks that get a page cited

| Block | What to put on the page | Why models use it |
| --- | --- | --- |
| Answer first | The definition in the opening 80 words | It becomes the quotable span |
| Question headings | The exact query as an H2 | Retrieval matches the heading |
| One comparison table | Options, costs, or criteria | Tables survive summarization |
| Named proof | A metric, a date, a method | Vague claims get dropped |
| Crawl permission | \`llms.txt\` plus a robots rule that allows GPTBot, PerplexityBot, and Google-Extended | A blocked URL cannot be cited |

If any row is missing, fix that row before you publish another post. More pages do not help if every page is written the same vague way.

## A real failure we see on scans

A services company ranks on page one for "website audit tool" and still never appears in Perplexity. The scan shows three separate problems:

- \`robots.txt\` disallows \`/blog\` for every user agent, so the articles that would have been cited are invisible.
- There is no \`/llms.txt\` telling assistants which URLs are the canonical explanations.
- The top article buries the answer under a 200-word brand story. The model quotes a competitor who defined the term in sentence one.

None of that is a content-volume problem. It is an extraction problem. [Run the free scan](/scanner) and read the GEO section before you rewrite the whole site. The same checks are covered in [how Google AI Overviews cut your clicks](/blog/google-ai-overviews-took-your-clicks).

## What to publish this week

Write one page per money query. Use this shape:

1. State the answer in the first paragraph. Include the term people type.
2. Add an H2 that repeats the question.
3. Add one table or a numbered fix list.
4. Link to the next page on your own site. Orphan pages are rarely retrieved.
5. Allow the crawlers, then request a recrawl by updating the sitemap \`lastmod\`.

Internal links matter here as much as they do in classic SEO. This article points at the [scanner](/scanner) and the [INP guide](/blog/interaction-to-next-paint-is-costing-you-customers) because a cited page should hand the reader (and the model) a second URL on the same domain.

## What not to do

- Do not stuff "ChatGPT SEO" into headings that do not answer anything.
- Do not block AI crawlers and then wonder why you are not cited.
- Do not hide the only useful paragraph behind a login. Models cannot quote what they cannot fetch.

If you want the full issue list instead of a summary, the [scanner](/scanner) breaks robots rules, missing answer blocks, and slow templates into a checklist your developer can ship. Questions about a specific site go through [contact](/contact).
`,
  },
  {
    slug: "interaction-to-next-paint-is-costing-you-customers",
    title: "Interaction to Next Paint Is Costing You Customers",
    excerpt:
      "INP replaced First Input Delay as a Core Web Vital. If the page paints late after a tap, shoppers leave and Google has a number to prove it.",
    category: "Performance",
    date: "October 19, 2026",
    readTime: "7 min read",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80",
    ...author,
    tags: [
      "interaction to next paint",
      "Core Web Vitals",
      "INP",
      "page speed",
      "conversion rate",
    ],
    content: `Interaction to Next Paint (INP) measures the delay between a tap, click, or keypress and the next time the browser paints a frame. Google's good threshold is 200 milliseconds or less at the 75th percentile of visits. Above 500 milliseconds the page is poor. Shoppers do not wait for a button to acknowledge them, and the ranking systems that still use page experience can see the same delay you feel.

First Input Delay only timed the first interaction. INP watches interactions across the whole visit, so a fast homepage and a frozen checkout both show up. That is why sites that "passed Core Web Vitals" in 2023 fail them now.

## Where the time actually goes

INP is not a single slow image. It is usually one of these:

- A long JavaScript task on the main thread while the user taps "Add to cart."
- A third-party chat, tag manager, or A/B tool that runs during the click.
- A hydration step that attaches listeners only after a large bundle downloads.
- Layout work that runs because a banner injects itself above the button.

> **Direct answer:** If INP is over 200 ms, find the long task that runs on click, split it, and stop non-critical scripts from executing on the interaction path. The metric moves when the main thread is free at the moment of the tap.

![An analytics dashboard used to spot a slow interaction, not just a slow load](https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=80)

## Thresholds you can hand to a developer

| INP at the 75th percentile | Rating | What to do this sprint |
| --- | --- | --- |
| 200 ms or less | Good | Keep the interaction path free of new tags |
| 201–500 ms | Needs improvement | Profile the click in Chrome Performance and cut the longest task |
| Over 500 ms | Poor | Remove or defer the script that runs inside the event handler |

LCP (loading) and CLS (layout shift) still matter. They do not excuse a button that paints late. Treat INP as its own ticket, with its own owner.

## A checkout we measured

On a mid-size store, the product page loaded in under two seconds and still lost the add-to-cart tap. The performance trace showed a 640 ms task from a personalization script that rewrote the price on every click. INP at the 75th percentile was 580 ms on mobile. After the script was moved off the click handler and the price was rendered with the page, INP fell under 180 ms and the add-to-cart rate recovered in the next full week of traffic.

You do not need that anecdote to start. [Scan the URL](/scanner) and read the performance issues before you buy another tag. The same audit flags the SEO and accessibility problems that sit next to a slow handler. How those pages get cited once they are fast is covered in [why answer engines skip your site](/blog/why-chatgpt-and-perplexity-dont-cite-your-website).

## The fix order that works

1. Record one real mobile tap in Chrome DevTools, Performance panel, with CPU throttling on.
2. Find the long task whose start sits inside the click event.
3. Move analytics, chat, and experiments off that handler. They can run after the paint.
4. Break remaining work into tasks under 50 ms so the browser can paint between them.
5. Re-test the 75th percentile on field data, not a single lab run from your office connection.

Lab data lies when the office network is fast and the customer's phone is not. Field INP is the number that matches revenue.

## What this is worth

A late paint is a broken button from the customer's side of the glass. They tap twice, the second tap hits the wrong control, and they leave. That shows up as a conversion drop long before it shows up as a ranking drop.

If the scan turns up a pile of handlers you do not own, the [scanner](/scanner) lists which third parties run during input so you can remove them with evidence. For a template that is slow on every page, start with [the team](/about) and send the URL through [contact](/contact).
`,
  },
  {
    slug: "google-ai-overviews-took-your-clicks",
    title: "Google AI Overviews Took Your Clicks. Get Cited Instead.",
    excerpt:
      "Impressions stay flat while clicks fall when an AI Overview answers the query. These are the pages that still earn the citation and the visit.",
    category: "SEO",
    date: "October 19, 2026",
    readTime: "8 min read",
    image:
      "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?auto=format&fit=crop&w=1600&q=80",
    ...author,
    tags: [
      "Google AI Overviews",
      "zero-click search",
      "answer engine optimization",
      "SEO traffic",
      "featured citations",
    ],
    content: `Google AI Overviews answer the query above the classic blue links. Informational searches that used to send the click to your blog now end on the results page. Impressions in Search Console stay steady. Clicks and average position get worse on the queries the overview covers. That gap is the zero-click problem, and publishing more of the same thin posts makes it larger.

You cannot turn the overview off. You can become one of the few sources it quotes, and you can aim the queries you still own at pages that are not fully answered in two sentences.

## Which queries you just lost

Split the query list into two piles.

| Query type | What the overview does | What you should publish |
| --- | --- | --- |
| "What is X" | Answers it in full | A definition page with one extra depth the overview cannot fit: a table, a worked example, or a tool |
| "X vs Y" | Compares the obvious points | Your own comparison with prices, limits, and a recommendation |
| "How to X" with a short answer | Lists the steps | A step page that includes the failure cases and a screenshot |
| "X near me" or a product name | Often skips the overview | Keep these. They still send the click |
| A query only your product solves | Rarely summarized well | Build the tool page and point informational posts at it |

The last row is the one most sites skip. They write another definition and hope. The click comes back when the article hands the reader a job the overview cannot finish.

> **Direct answer:** Treat AI Overviews as a citation fight on head terms and a click fight on job-to-be-done terms. Win the quote with an answer-first paragraph. Win the visit with a next step the summary does not replace.

![Someone comparing sources, which is what a zero-click result forces the reader to do](https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=80)

## How a cited paragraph is built

Look at a query you lost in Search Console: impressions up, clicks down, over the last 28 days. Open the page that used to rank. Rewrite only the top of it:

1. First paragraph: the answer, in plain sentences, with the query's words in it.
2. Second paragraph: the limit of that answer. What the overview leaves out.
3. A table or a numbered list the model can compress but not replace.
4. A link to the tool or the service that finishes the job.
5. A date, so the passage looks maintained.

Then link sideways. An overview citation is more likely when your domain has two pages that agree with each other. This piece links to [the INP article](/blog/interaction-to-next-paint-is-costing-you-customers) and to [why Perplexity skips unquotable sites](/blog/why-chatgpt-and-perplexity-dont-cite-your-website). Both support the same point: extraction, not volume.

## The page that still gets the click

For Anavya, the query "what is generative engine optimization" can be answered in an overview. The query "why is my site not cited by ChatGPT" cannot be finished there, because the answer depends on that site's robots file, its first paragraph, and its INP. That is why the article ends at the [scanner](/scanner) instead of at another definition.

Use the same pattern on your site:

- Informational post states the rule.
- The next link opens a page that runs the rule on the reader's URL, price, or template.
- [About](/about) is for the person who wants to know who is doing the audit.
- [Contact](/contact) is for the site that needs the checklist applied by someone else.

## What to watch for 30 days

Track three numbers, not one:

- Clicks on the queries that trigger an overview. Expect these to stay down. Do not panic-rewrite them every week.
- Citations or referral visits from chat tools, if your analytics splits them out.
- Clicks on the job queries that point at the tool. These should rise if the internal links are real.

If clicks on the tool page do not move, the article is still a dead end. Add the link higher. A citation that never offers the next step brings brand mentions and no pipeline.

The [free scan](/scanner) is the next step on this site. It checks the same extraction and speed issues these three articles describe, on the URL you actually own.
`,
  },
];

export async function seedBlogs() {
  await db.delete(blogs);
  await db.insert(blogs).values(fallbackBlogsData);
  console.log("✓ Replaced blogs with 3 original MDX posts");
}
