export interface AiCrawler {
  readonly agent: string;
  readonly owner: string;
  readonly points: number;
}

export const AI_CRAWLERS: readonly AiCrawler[] = [
  { agent: "GPTBot", owner: "OpenAI", points: 15 },
  { agent: "OAI-SearchBot", owner: "OpenAI", points: 15 },
  { agent: "ChatGPT-User", owner: "OpenAI", points: 15 },
  { agent: "ClaudeBot", owner: "Anthropic", points: 15 },
  { agent: "Claude-SearchBot", owner: "Anthropic", points: 15 },
  { agent: "PerplexityBot", owner: "Perplexity", points: 15 },
  { agent: "Google-Extended", owner: "Google AI", points: 2.5 },
  { agent: "GoogleOther", owner: "Google", points: 2.5 },
  { agent: "Applebot-Extended", owner: "Apple", points: 2.5 },
  { agent: "Amazonbot", owner: "Amazon", points: 2.5 },
];

interface RobotsGroup {
  readonly agents: readonly string[];
  readonly allow: readonly string[];
  readonly disallow: readonly string[];
}

export interface ParsedRobots {
  readonly groups: readonly RobotsGroup[];
  readonly sitemaps: readonly string[];
}

export function parseRobots(text: string): ParsedRobots {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  const sitemaps: string[] = [];
  let current: { agents: string[]; allow: string[]; disallow: string[] } | null = null;
  let lastWasAgent = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const match = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!match) continue;
    const key = match[1]!.toLowerCase();
    const value = match[2]!.trim();

    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }

    lastWasAgent = false;
    if (key === "sitemap" && value) sitemaps.push(value);
    else if (key === "allow" && current) current.allow.push(value);
    else if (key === "disallow" && current) current.disallow.push(value);
  }

  return { groups, sitemaps };
}

const ROOT_RULES = new Set(["/", "/*"]);

export function isCrawlerAllowed(robots: ParsedRobots, agent: string) {
  const name = agent.toLowerCase();
  const group =
    robots.groups.find((g) => g.agents.includes(name)) ??
    robots.groups.find((g) => g.agents.includes("*"));
  if (!group) return true;
  const blocksRoot = group.disallow.some((p) => ROOT_RULES.has(p));
  const allowsRoot = group.allow.some((p) => ROOT_RULES.has(p));
  return !blocksRoot || allowsRoot;
}
