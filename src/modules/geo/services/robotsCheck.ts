import axios from "axios";
import { safeRedirects } from "../../../lib/safeUrl.js";

export interface RobotsResult {
  allowedBots: string[];
  blockedBots: string[];
  missing: boolean;
}

const TARGET_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "GoogleOther",
  "CCBot",
  "Applebot-Extended"
];

export async function checkRobots(baseUrl: string): Promise<RobotsResult> {
  const robotsUrl = `${baseUrl.replace(/\/$/, "")}/robots.txt`;

  try {
    const response = await axios.get(robotsUrl, {
      ...safeRedirects,
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/plain"
      }
    });

    const content = response.data;
    if (typeof content !== "string" || !content.trim()) {
      return { allowedBots: [...TARGET_BOTS], blockedBots: [], missing: true };
    }

    const lines = content.split(/\r?\n/);
    const rules: { [agent: string]: { disallow: string[]; allow: string[] } } = {};
    let currentAgents: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const userAgentMatch = line.match(/^user-agent:\s*(.+)$/i);
      if (userAgentMatch && userAgentMatch[1]) {
        const agent = userAgentMatch[1].trim().toLowerCase();
        // Reset current agent list if starting a new block after some rules
        if (currentAgents.length > 0 && !line.toLowerCase().startsWith("user-agent")) {
          currentAgents = [];
        }
        currentAgents.push(agent);
        if (!rules[agent]) {
          rules[agent] = { disallow: [], allow: [] };
        }
        continue;
      }

      const disallowMatch = line.match(/^disallow:\s*(.*)$/i);
      if (disallowMatch && disallowMatch[1] !== undefined && currentAgents.length > 0) {
        const path = disallowMatch[1].trim();
        for (const agent of currentAgents) {
          if (rules[agent]) {
            rules[agent].disallow.push(path);
          }
        }
        continue;
      }

      const allowMatch = line.match(/^allow:\s*(.*)$/i);
      if (allowMatch && allowMatch[1] !== undefined && currentAgents.length > 0) {
        const path = allowMatch[1].trim();
        for (const agent of currentAgents) {
          if (rules[agent]) {
            rules[agent].allow.push(path);
          }
        }
        continue;
      }
    }

    const allowedBots: string[] = [];
    const blockedBots: string[] = [];

    const isPathBlocked = (disallowPaths: string[], allowPaths: string[]): boolean => {
      const blocksRoot = disallowPaths.some(p => p === "/" || p === "/*");
      if (blocksRoot) {
        const allowsRoot = allowPaths.some(p => p === "/" || p === "/*");
        return !allowsRoot;
      }
      return false;
    };

    for (const bot of TARGET_BOTS) {
      const botLower = bot.toLowerCase();
      
      const botRule = rules[botLower];
      if (botRule) {
        if (isPathBlocked(botRule.disallow, botRule.allow)) {
          blockedBots.push(bot);
        } else {
          allowedBots.push(bot);
        }
        continue;
      }

      const genericRule = rules["*"];
      if (genericRule) {
        if (isPathBlocked(genericRule.disallow, genericRule.allow)) {
          blockedBots.push(bot);
        } else {
          allowedBots.push(bot);
        }
        continue;
      }

      allowedBots.push(bot);
    }

    return {
      allowedBots,
      blockedBots,
      missing: false
    };

  } catch {
    return {
      allowedBots: [...TARGET_BOTS],
      blockedBots: [],
      missing: true
    };
  }
}
