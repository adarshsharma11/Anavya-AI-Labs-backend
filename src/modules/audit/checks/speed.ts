import type { PageSpeedResult } from "../../../lib/pagespeed.js";
import type { CheckResult } from "../types.js";
import { scored } from "./define.js";

export function runSpeedChecks(speed: PageSpeedResult): CheckResult[] {
  const score = speed.performanceScore;
  const lcp = speed.field?.lcpMs ?? speed.lab.lcpMs;
  const cls = speed.field?.cls ?? speed.lab.cls;
  const inp = speed.field?.inpMs ?? null;
  const tbt = speed.lab.tbtMs;

  return [
    scored(
      { id: "performance_score", category: "speed", label: "Performance Score", maxPoints: 60, why: "The Lighthouse performance score summarises loading, interactivity, and visual stability." },
      score >= 90 ? 60 : score >= 50 ? 40 : Math.round((score / 50) * 20),
      `Raw performance score: ${score} (mobile)`,
      "Compress and resize images (WebP or AVIF), defer non-critical JavaScript, and remove unused third-party scripts.",
    ),
    scored(
      { id: "lcp", category: "speed", label: "Largest Contentful Paint (LCP)", maxPoints: 20, why: "LCP measures how quickly the main content becomes visible to users." },
      lcp === null ? 0 : lcp <= 2500 ? 20 : lcp <= 4000 ? 10 : 0,
      lcp === null ? "LCP not measured" : `LCP: ${(lcp / 1000).toFixed(1)} s`,
      "Make the hero image smaller (WebP or AVIF), preload it with <link rel=\"preload\">, and avoid lazy-loading anything above the fold.",
    ),
    scored(
      { id: "cls", category: "speed", label: "Cumulative Layout Shift (CLS)", maxPoints: 10, why: "Layout shift makes pages feel broken and hurts the user-experience signals."},
      cls === null ? 0 : cls <= 0.1 ? 10 : cls <= 0.25 ? 5 : 0,
      cls === null ? "CLS not measured" : `CLS: ${cls}`,
      "Set width and height on images and embeds, and reserve space for banners and ads so content does not jump.",
    ),
    inp !== null
      ? scored(
          { id: "inp", category: "speed", label: "Interaction to Next Paint (INP)", maxPoints: 10, why: "INP measures how fast the page reacts when someone clicks or taps." },
          inp <= 200 ? 10 : inp <= 500 ? 5 : 0,
          `INP: ${inp} ms`,
          "Break up long JavaScript tasks and load chat widgets and trackers after the page is interactive.",
        )
      : scored(
          { id: "inp", category: "speed", label: "Interactivity (Total Blocking Time)", maxPoints: 10, why: "Blocking time measures how long the page freezes before it can respond to taps (no real-user INP data yet)." },
          tbt === null ? 0 : tbt <= 200 ? 10 : tbt <= 600 ? 5 : 0,
          tbt === null ? "Not measured" : `Total Blocking Time: ${Math.round(tbt)} ms (no real-user INP data)`,
          "Break up long JavaScript tasks and load chat widgets and trackers after the page is interactive.",
        ),
  ];
}
