import type { PageSpeedResult } from "../../../lib/pagespeed.js";
import type { PageData } from "../extract.js";
import type { CheckResult } from "../types.js";
import { notApplicable, scored } from "./define.js";

/** Estimates speed from our own fetch when Google PageSpeed is unavailable. */
export function runBasicSpeedChecks(page: PageData, responseMs: number): CheckResult[] {
  const blocking = page.renderBlockingScripts + Math.max(0, page.stylesheets - 1);
  const lazyCandidates = Math.max(0, page.images - 2);
  const lazyDef = {
    id: "lazy_images",
    category: "speed",
    label: "Lazy-Loaded Images",
    maxPoints: 15,
    why: "Images below the fold that load immediately compete with the main content for bandwidth.",
  } as const;

  return [
    scored(
      { id: "response_time", category: "speed", label: "Server Response Time", maxPoints: 40, why: "A slow server delays everything else on the page, for visitors and AI crawlers alike." },
      responseMs <= 600 ? 40 : responseMs <= 1500 ? 25 : responseMs <= 3000 ? 10 : 0,
      `Page HTML delivered in ${(responseMs / 1000).toFixed(1)} s (basic check: connect your PageSpeed API key for Core Web Vitals)`,
      "Enable caching or a CDN for HTML, upgrade slow hosting, and reduce server-side work before the first byte.",
    ),
    scored(
      { id: "html_weight", category: "speed", label: "HTML Weight", maxPoints: 20, why: "Heavy HTML takes longer to download and parse, especially on mobile." },
      page.sizeKB <= 100 ? 20 : page.sizeKB <= 250 ? 10 : 0,
      `HTML size: ${page.sizeKB} KB`,
      "Remove inlined data blobs and unused markup, and paginate very long lists.",
    ),
    scored(
      { id: "render_blocking", category: "speed", label: "Render-Blocking Resources", maxPoints: 25, why: "Scripts and stylesheets in the head stop the browser from showing anything until they load." },
      blocking <= 1 ? 25 : blocking <= 4 ? 12 : 0,
      `${page.renderBlockingScripts} blocking scripts and ${page.stylesheets} stylesheets in the page head`,
      "Add defer or async to scripts, inline critical CSS, and combine or remove extra stylesheets.",
    ),
    lazyCandidates === 0
      ? notApplicable(lazyDef, "the page has only a few images")
      : scored(
          lazyDef,
          page.lazyImages >= lazyCandidates / 2 ? 15 : page.lazyImages > 0 ? 7 : 0,
          `${page.lazyImages} of ${page.images} images use loading="lazy"`,
          'Add loading="lazy" to images below the fold (keep the hero image eager).',
        ),
  ];
}

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
