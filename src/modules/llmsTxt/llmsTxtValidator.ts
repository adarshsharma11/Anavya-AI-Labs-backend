import type {
  ExtractedLink,
  LlmsTxtValidationResult,
  ValidationFinding,
  ValidationSummary,
} from './types.js';

interface SectionInfo {
  title: string;
  line: number;
  isOptional: boolean;
  itemCount: number;
}

/**
 * Validates markdown content according to the llmstxt.org specification.
 *
 * Specification rules:
 * 1. Single H1 (# Project Title) is the core required element.
 * 2. Blockquote (> Summary) directly under H1 is recommended.
 * 3. Headings deeper than H2 (###, ####) are not allowed in pure llms.txt.
 * 4. Sections are delimited by H2 (## Section Title).
 * 5. List items inside sections follow `- [Name](URL): description`.
 * 6. URLs must be absolute (http:// or https://).
 * 7. Duplicate URLs should be avoided.
 * 8. `## Optional` section is supported for secondary resources.
 */
export function validateLlmsTxt(content: string): LlmsTxtValidationResult {
  const raw = content ?? '';
  const lines = raw.split(/\r?\n/);
  const checks: ValidationFinding[] = [];
  const links: ExtractedLink[] = [];

  // Parse structure
  const h1s: { title: string; line: number }[] = [];
  const h2s: SectionInfo[] = [];
  const deeperHeadings: { level: number; title: string; line: number }[] = [];
  let blockquoteFound = false;
  let blockquoteLine: number | undefined;
  let currentSection: SectionInfo | null = null;
  const seenUrls = new Map<string, number[]>(); // url -> line numbers

  const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (!trimmed) continue;

    // Detect Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch && headingMatch[1] && headingMatch[2]) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();

      if (level === 1) {
        h1s.push({ title, line: lineNumber });
      } else if (level === 2) {
        const isOpt = /^optional\b/i.test(title);
        currentSection = {
          title,
          line: lineNumber,
          isOptional: isOpt,
          itemCount: 0,
        };
        h2s.push(currentSection);
      } else {
        deeperHeadings.push({ level, title, line: lineNumber });
      }
      continue;
    }

    // Detect Blockquote under H1 (before any H2)
    if (trimmed.startsWith('>') && h1s.length > 0 && h2s.length === 0 && !blockquoteFound) {
      blockquoteFound = true;
      blockquoteLine = lineNumber;
    }

    // Check list item and extract markdown links
    const isListItem = /^[-*+]\s+/.test(trimmed);
    let match: RegExpExecArray | null;
    linkRegex.lastIndex = 0;

    let lineHasLink = false;
    while ((match = linkRegex.exec(trimmed)) !== null) {
      lineHasLink = true;
      const linkTitle = (match[1] ?? '').trim();
      const rawUrl = (match[2] ?? '').trim();

      // Check if description follows ": "
      const afterMatch = trimmed.slice(match.index + match[0].length).trim();
      let description: string | undefined;
      if (afterMatch.startsWith(':')) {
        description = afterMatch.replace(/^:\s*/, '').trim();
      } else if (afterMatch.length > 0) {
        description = afterMatch;
      }

      const isAbsolute = /^https?:\/\//i.test(rawUrl);
      const normalizedUrl = rawUrl.toLowerCase();
      const existingLines = seenUrls.get(normalizedUrl) ?? [];
      const isDuplicate = existingLines.length > 0;
      existingLines.push(lineNumber);
      seenUrls.set(normalizedUrl, existingLines);

      links.push({
        title: linkTitle || 'Untitled',
        url: rawUrl,
        description: description || undefined,
        section: currentSection?.title,
        line: lineNumber,
        isAbsolute,
        isDuplicate,
      });

      if (currentSection) {
        currentSection.itemCount++;
      }
    }

    // Detect malformed markdown link syntax (e.g. unclosed bracket or empty parenthesis)
    if (isListItem && !lineHasLink) {
      if (/\[[^\]]*\](?!\()/.test(trimmed) && !/\[[ xX]\]/.test(trimmed)) {
        // Bracket without closing parenthesis
        checks.push({
          id: 'malformed-link-syntax',
          name: 'Malformed Link Syntax',
          status: 'fail',
          severity: 'error',
          line: lineNumber,
          message: `Malformed link syntax on line ${lineNumber}. Missing opening or closing parentheses for link destination.`,
          explanation: 'Links must follow the standard Markdown format: [Anchor Text](https://example.com/url).',
          suggestedCorrection: 'Ensure brackets are immediately followed by (URL).',
        });
      }
    }
  }

  // --- Rule 1: H1 Project Title (Required) ---
  if (h1s.length === 0) {
    checks.push({
      id: 'h1-title',
      name: 'Project Title (H1)',
      status: 'fail',
      severity: 'error',
      message: 'Missing H1 project title. The file must start with a single "# Project Title".',
      explanation: 'The llms.txt specification mandates an H1 title indicating the project, organization, or site name.',
      suggestedCorrection: '# Project Name\n\n> A short description of the project.\n',
    });
  } else if (h1s.length > 1) {
    const extraLines = h1s.slice(1).map((h) => `line ${h.line}`).join(', ');
    checks.push({
      id: 'h1-title',
      name: 'Project Title (H1)',
      status: 'fail',
      severity: 'error',
      line: h1s[1]?.line,
      message: `Multiple H1 headings detected (${extraLines}). Only a single H1 project title is allowed.`,
      explanation: 'The specification permits only one top-level H1 heading at the top of the file.',
      suggestedCorrection: 'Change secondary H1 headings to H2 (## Section Title).',
    });
  } else {
    // Exactly one H1
    const singleH1 = h1s[0]!;
    if (h2s.length > 0 && (h2s[0]?.line ?? 0) < singleH1.line) {
      checks.push({
        id: 'h1-title',
        name: 'Project Title (H1)',
        status: 'fail',
        severity: 'error',
        line: singleH1.line,
        message: 'The H1 project title appears after an H2 section. It must be the first heading in the file.',
        explanation: 'The H1 title establishes the context for the entire document and must precede all section headings.',
        suggestedCorrection: 'Move the H1 heading to the very beginning of the document.',
      });
    } else {
      checks.push({
        id: 'h1-title',
        name: 'Project Title (H1)',
        status: 'pass',
        severity: 'error',
        line: singleH1.line,
        message: `H1 project title found: "${singleH1.title}".`,
      });
    }
  }

  // --- Rule 2: Blockquote Summary (Recommended) ---
  if (blockquoteFound) {
    checks.push({
      id: 'blockquote-summary',
      name: 'Blockquote Summary',
      status: 'pass',
      severity: 'warning',
      line: blockquoteLine,
      message: 'Blockquote summary found directly below the project title.',
    });
  } else {
    checks.push({
      id: 'blockquote-summary',
      name: 'Blockquote Summary',
      status: 'warning',
      severity: 'warning',
      line: h1s[0]?.line,
      message: 'Consider adding a concise summary blockquote (> Summary) under the H1.',
      explanation: 'While optional per specification, a blockquote summary provides critical guidance for AI systems.',
      suggestedCorrection: '> Concise 1-2 sentence summary of this site and its content.',
    });
  }

  // --- Rule 3: Heading Levels (No deeper than H2) ---
  if (deeperHeadings.length > 0) {
    const list = deeperHeadings.map((h) => `line ${h.line} (${'#'.repeat(h.level)} ${h.title})`).join(', ');
    checks.push({
      id: 'heading-levels',
      name: 'Heading Levels (H1/H2 Only)',
      status: 'warning',
      severity: 'warning',
      line: deeperHeadings[0]?.line,
      message: `Found ${deeperHeadings.length} heading(s) deeper than H2: ${list}.`,
      explanation: 'The llms.txt standard permits only H1 (#) and H2 (##) headings. Deeper levels break parser compatibility.',
      suggestedCorrection: 'Convert deeper headings (###+) to bold text (**Subheading**) or use standard H2 sections.',
    });
  } else {
    checks.push({
      id: 'heading-levels',
      name: 'Heading Levels (H1/H2 Only)',
      status: 'pass',
      severity: 'warning',
      message: 'All headings adhere to H1 and H2 levels only.',
    });
  }

  // --- Rule 4: Section Structure & Empty Sections ---
  if (h2s.length === 0) {
    checks.push({
      id: 'section-structure',
      name: 'Section Structure (H2)',
      status: 'warning',
      severity: 'warning',
      message: 'No H2 sections found. A complete llms.txt organizes documentation and resources into H2 sections.',
      explanation: 'Sections like "## Documentation", "## Guides", and "## API Reference" help categorize content for LLMs.',
      suggestedCorrection: '## Documentation\n\n- [Getting Started](https://example.com/docs): Introduction guide',
    });
  } else {
    const emptySections = h2s.filter((s) => s.itemCount === 0);
    if (emptySections.length > 0) {
      const titles = emptySections.map((s) => `"${s.title}" (line ${s.line})`).join(', ');
      checks.push({
        id: 'section-structure',
        name: 'Section Structure (H2)',
        status: 'warning',
        severity: 'warning',
        line: emptySections[0]?.line,
        message: `Empty section(s) detected: ${titles}.`,
        explanation: 'Sections should contain at least one resource link or descriptive content.',
        suggestedCorrection: 'Add resource links formatted as `- [Title](https://...): Notes` or remove empty sections.',
      });
    } else {
      checks.push({
        id: 'section-structure',
        name: 'Section Structure (H2)',
        status: 'pass',
        severity: 'warning',
        message: `Found ${h2s.length} well-structured H2 section(s) with resource entries.`,
      });
    }
  }

  // --- Rule 5: Link Syntax & Absolute URLs ---
  const relativeLinks = links.filter((l) => !l.isAbsolute);
  const emptyUrlLinks = links.filter((l) => !l.url || l.url === '');

  if (links.length === 0) {
    checks.push({
      id: 'link-syntax',
      name: 'Markdown Links',
      status: 'warning',
      severity: 'warning',
      message: 'No markdown links found in the file.',
      explanation: 'The primary purpose of an llms.txt file is to point language models to clean markdown resources.',
      suggestedCorrection: '- [Title](https://example.com/page.md): Description of the resource',
    });
  } else if (emptyUrlLinks.length > 0) {
    checks.push({
      id: 'link-syntax',
      name: 'Markdown Links',
      status: 'fail',
      severity: 'error',
      line: emptyUrlLinks[0]?.line,
      message: `Found ${emptyUrlLinks.length} link(s) with empty destinations (e.g. line ${emptyUrlLinks[0]?.line}).`,
      explanation: 'Every markdown link must specify a valid destination URL.',
      suggestedCorrection: 'Provide full destination URLs inside parentheses.',
    });
  } else if (relativeLinks.length > 0) {
    const samples = relativeLinks.slice(0, 3).map((l) => `"${l.url}" on line ${l.line}`).join(', ');
    checks.push({
      id: 'link-syntax',
      name: 'Markdown Links',
      status: 'fail',
      severity: 'error',
      line: relativeLinks[0]?.line,
      message: `Found ${relativeLinks.length} relative URL(s): ${samples}. llms.txt requires absolute URLs.`,
      explanation: 'Large Language Models do not possess local origin context and require full http:// or https:// URLs.',
      suggestedCorrection: 'Prepend the domain name (e.g., https://example.com/path) to make all URLs absolute.',
    });
  } else {
    checks.push({
      id: 'link-syntax',
      name: 'Markdown Links',
      status: 'pass',
      severity: 'error',
      message: `All ${links.length} link(s) use valid absolute HTTP/HTTPS URLs.`,
    });
  }

  // --- Rule 6: Duplicate Links ---
  const duplicates = Array.from(seenUrls.entries()).filter(([_, lineNums]) => lineNums.length > 1);
  if (duplicates.length > 0) {
    const dupDetails = duplicates.map(([url, lineNums]) => `"${url}" on lines ${lineNums.join(', ')}`).join('; ');
    checks.push({
      id: 'duplicate-links',
      name: 'Duplicate Links',
      status: 'warning',
      severity: 'warning',
      message: `Found ${duplicates.length} duplicate URL(s): ${dupDetails}.`,
      explanation: 'Duplicate links needlessly consume LLM context window tokens.',
      suggestedCorrection: 'Consolidate or remove repeated URLs.',
    });
  } else if (links.length > 0) {
    checks.push({
      id: 'duplicate-links',
      name: 'Duplicate Links',
      status: 'pass',
      severity: 'warning',
      message: 'No duplicate links detected.',
    });
  }

  // --- Rule 7: Optional Section Convention ---
  const optionalSection = h2s.find((s) => s.isOptional);
  if (optionalSection) {
    checks.push({
      id: 'optional-section',
      name: 'Optional Section',
      status: 'pass',
      severity: 'info',
      line: optionalSection.line,
      message: `Found standard "## Optional" section on line ${optionalSection.line} with ${optionalSection.itemCount} resource(s).`,
      explanation: 'The "Optional" section signals to AI agents that these resources can be skipped when context is limited.',
    });
  } else {
    checks.push({
      id: 'optional-section',
      name: 'Optional Section',
      status: 'skipped',
      severity: 'info',
      message: 'No "## Optional" section present (this section is optional per specification).',
    });
  }

  // Calculate summary counts
  const errors = checks.filter((c) => c.status === 'fail').length;
  const warnings = checks.filter((c) => c.status === 'warning').length;
  const passed = checks.filter((c) => c.status === 'pass').length;
  const skipped = checks.filter((c) => c.status === 'skipped').length;
  const valid = errors === 0;

  // Objective scoring calculation (100 max: -25 per error, -10 per warning, min 0)
  let score = 100 - (errors * 25) - (warnings * 10);
  if (score < 0) score = 0;
  if (!valid && score > 60) score = 60; // Cannot score higher than 60 if failing required rules

  const summary: ValidationSummary = {
    valid,
    errors,
    warnings,
    passed,
    skipped,
    score,
  };

  // Safe deterministic correction
  const correctedMarkdown = generateCorrectedMarkdown(raw, {
    deeperHeadings,
    relativeLinks,
  });

  return {
    summary,
    checks,
    links,
    correctedMarkdown: correctedMarkdown !== raw ? correctedMarkdown : undefined,
    markdown: raw,
  };
}

/**
 * Deterministically corrects safe, non-destructive markdown issues:
 * 1. Converts deeper headings (###+) to bold markdown subheadings.
 * 2. Formats list item description separator `: ` consistently.
 * 3. Prepends `https://` to protocol-relative or scheme-less domain URLs in markdown links.
 */
export function generateCorrectedMarkdown(
  raw: string,
  hints?: {
    deeperHeadings?: { level: number; title: string; line: number }[];
    relativeLinks?: ExtractedLink[];
    baseDomain?: string;
  }
): string {
  const lines = raw.split(/\r?\n/);
  const correctedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i] ?? '';

    // Convert ###+ to bold
    const headingMatch = line.match(/^(\s*)(#{3,6})\s+(.*)$/);
    if (headingMatch && headingMatch[1] !== undefined && headingMatch[3]) {
      const indent = headingMatch[1];
      const title = headingMatch[3].trim();
      line = `${indent}**${title}**`;
    }

    // Fix link formatting: if URL is domain without protocol e.g. [Doc](example.com/doc)
    line = line.replace(/\[([^\]]+)\]\((www\.[^)]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^)]*)\)/g, (_all, title, url) => {
      if (!/^https?:\/\//i.test(url)) {
        return `[${title}](https://${url})`;
      }
      return _all;
    });

    // If baseDomain is supplied, fix relative links e.g. /docs -> https://domain.com/docs
    if (hints?.baseDomain) {
      const base = hints.baseDomain.replace(/\/+$/, '');
      line = line.replace(/\[([^\]]+)\]\((\/[^)]*)\)/g, (_all, title, relPath) => {
        return `[${title}](${base}${relPath})`;
      });
    }

    // Normalize spacing after colon for list item descriptions: - [Title](url):desc -> - [Title](url): desc
    line = line.replace(/(\[[^\]]+\]\([^)]+\)):([^\s])/g, '$1: $2');

    correctedLines.push(line);
  }

  return correctedLines.join('\n');
}
