import {
  CATEGORY_IDS,
  CATEGORY_LABELS,
  type AuditReport,
  type CategoryId,
  type CheckResult,
} from '../../modules/audit/types.js';
import { verdictFor } from '../../modules/audit/score.js';
import { escapeHtml, list, paragraphs, safeLogoUrl, type PdfBranding } from './html.js';

const SHORT_LABELS: Readonly<Record<CategoryId, string>> = {
  aeo: 'AEO',
  geo: 'GEO',
  crawlers: 'AI Crawlers',
  technical: 'Technical',
  content: 'Content',
  speed: 'Page Speed',
};

const STATUS_ICON = { pass: '✓', na: '✓', partial: '!', fail: '×' } as const;
const PRIORITY_LABEL = { critical: 'CRITICAL', important: 'IMPORTANT', minor: 'MINOR' } as const;

const tone = (score: number | null) =>
  score === null ? 'muted' : score >= 70 ? 'good' : score >= 50 ? 'warn' : 'bad';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';

const pts = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const checkRow = (c: CheckResult) => `
  <tr class="row-${c.status}">
    <td class="icon ${c.status}">${STATUS_ICON[c.status]}</td>
    <td><strong>${escapeHtml(c.label)}</strong><div class="evidence">${escapeHtml(c.evidence)}</div></td>
    <td class="pts">${pts(c.points)}/${pts(c.maxPoints)} pts</td>
  </tr>`;

const categoryTable = (id: CategoryId, score: number | null, checks: readonly CheckResult[]) => {
  const rows = checks.filter((c) => c.category === id);
  if (!rows.length) return '';
  return `
    <div class="block">
      <div class="block-head">
        <h3>${escapeHtml(CATEGORY_LABELS[id])}</h3>
        <span class="pill ${tone(score)}">${score ?? '—'} · ${score === null ? 'Pending' : verdictFor(score)}</span>
      </div>
      <table class="checks">${rows.map(checkRow).join('')}</table>
    </div>`;
};

export function buildAuditHtml(
  report: AuditReport,
  aiReport: Record<string, unknown> | null,
  branding: PdfBranding,
  supportUrl: string | null,
) {
  const brand = branding.companyName || 'Anavya AI Labs';
  const logo = safeLogoUrl(branding.companyLogoUrl);
  const home = report.pages[0];
  const homeChecks = [...report.siteChecks, ...(home?.checks ?? [])];

  const categoryBars = CATEGORY_IDS.map((id) => {
    const value = report.categories[id];
    return `
      <div class="bar-row">
        <span class="bar-label">${SHORT_LABELS[id]}</span>
        <div class="bar"><div class="fill ${tone(value)}" style="width:${value ?? 0}%"></div></div>
        <span class="bar-value">${value ?? 'n/a'}</span>
      </div>`;
  }).join('');

  const categoryCards = CATEGORY_IDS.map((id) => {
    const value = report.categories[id];
    return `<div class="card"><span>${SHORT_LABELS[id]}</span><strong class="${tone(value)}">${value ?? '—'}<small>/100</small></strong><em>${value === null ? 'Not measured' : verdictFor(value)}</em></div>`;
  }).join('');

  const recommendations = report.recommendations.slice(0, 10).map((r) => `
    <div class="rec">
      <div class="rec-head">
        <span class="badge ${r.priority}">${PRIORITY_LABEL[r.priority]}</span>
        <strong>${escapeHtml(r.label)}</strong>
        <span class="gain">+${r.gain} pts</span>
      </div>
      <p>${escapeHtml(r.fix)}</p>
      <p class="muted">${escapeHtml(r.evidence)}${r.affectedPages.length > 1 ? ` · affects ${r.affectedPages.length} pages` : r.affectedPages.length === 0 ? ' · site-wide' : ''}</p>
      <p class="why"><strong>Why AI cares:</strong> ${escapeHtml(r.why)}</p>
    </div>`).join('');

  const pagesTable = report.pages.length > 1 ? `
    <div class="block page-break">
      <h2>Pages Analysed</h2>
      <table class="pages">
        <tr><th>Page</th><th>Type</th><th>Score</th><th>AEO</th><th>GEO</th><th>Words</th></tr>
        ${report.pages.map((p) => `
          <tr>
            <td>${escapeHtml(p.url)}</td>
            <td>${escapeHtml(p.pageType)}</td>
            <td class="${tone(p.overall)}"><strong>${p.overall}</strong></td>
            <td>${p.categories.aeo ?? '—'}</td>
            <td>${p.categories.geo ?? '—'}</td>
            <td>${p.stats.wordCount}</td>
          </tr>`).join('')}
      </table>
    </div>` : '';

  const otherPages = report.pages.slice(1).map((p) => {
    const failing = p.checks.filter((c) => c.status === 'fail' || c.status === 'partial');
    if (!failing.length) return '';
    return `
      <div class="block">
        <div class="block-head"><h3>${escapeHtml(p.url)}</h3><span class="pill ${tone(p.overall)}">${p.overall} · ${verdictFor(p.overall)}</span></div>
        <table class="checks">${failing.map(checkRow).join('')}</table>
      </div>`;
  }).join('');

  const ai = aiReport ?? null;
  const aiSection = ai ? `
    <div class="page-break">
      <h2>AI Strategy Report</h2>
      ${ai.executiveSummary ? `<div class="block"><h3>Executive Summary</h3>${paragraphs(ai.executiveSummary)}</div>` : ''}
      ${ai.technicalAnalysis ? `<div class="block"><h3>Technical Analysis</h3>${paragraphs(ai.technicalAnalysis)}</div>` : ''}
      ${Array.isArray(ai.geoImprovements) ? `<div class="block"><h3>Get Cited by AI Assistants</h3>${list(ai.geoImprovements)}</div>` : ''}
      ${Array.isArray(ai.seoImprovements) ? `<div class="block"><h3>SEO Improvements</h3>${list(ai.seoImprovements)}</div>` : ''}
      ${Array.isArray(ai.performanceImprovements) ? `<div class="block"><h3>Performance Improvements</h3>${list(ai.performanceImprovements)}</div>` : ''}
      ${Array.isArray(ai.businessGrowthSuggestions) ? `<div class="block"><h3>Business Growth</h3>${list(ai.businessGrowthSuggestions)}</div>` : ''}
      ${ai.competitorStrategy ? `<div class="block"><h3>Competitor Strategy</h3>${paragraphs(ai.competitorStrategy)}</div>` : ''}
      ${ai.estimatedTrafficImpact ? `<div class="block"><h3>Estimated Traffic Impact</h3>${paragraphs(ai.estimatedTrafficImpact)}</div>` : ''}
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AEO &amp; GEO Readiness Report: ${escapeHtml(report.url)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2933; font-size: 12px; line-height: 1.5; margin: 0; padding: 36px 40px; }
  h1 { font-size: 26px; margin: 4px 0; } h2 { font-size: 18px; margin: 24px 0 10px; } h3 { font-size: 14px; margin: 0; }
  .eyebrow { letter-spacing: .12em; font-size: 10px; color: #6b7280; text-transform: uppercase; }
  .muted { color: #6b7280; } .why { color: #374151; font-size: 11px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; }
  .header img { max-height: 40px; display: block; margin-bottom: 6px; }
  .hero { display: flex; gap: 28px; align-items: center; margin: 22px 0; }
  .score { width: 130px; height: 130px; border-radius: 50%; border: 10px solid; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
  .score strong { font-size: 38px; line-height: 1; } .score span { font-size: 11px; color: #6b7280; }
  .score.good { border-color: #16a34a; } .score.warn { border-color: #f59e0b; } .score.bad { border-color: #dc2626; }
  .good { color: #15803d; } .warn { color: #b45309; } .bad { color: #b91c1c; } .muted-tone { color: #6b7280; }
  .cards { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 10px 0 18px; }
  .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; text-align: center; }
  .card span { display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; }
  .card strong { font-size: 22px; display: block; } .card small { font-size: 10px; color: #9ca3af; } .card em { font-size: 10px; font-style: normal; color: #6b7280; }
  .bar-row { display: flex; align-items: center; gap: 10px; margin: 4px 0; }
  .bar-label { width: 90px; font-size: 11px; } .bar-value { width: 32px; text-align: right; font-weight: bold; }
  .bar { flex: 1; height: 10px; background: #f3f4f6; border-radius: 5px; overflow: hidden; }
  .fill { height: 100%; } .fill.good { background: #22c55e; } .fill.warn { background: #f59e0b; } .fill.bad { background: #ef4444; } .fill.muted { background: #d1d5db; }
  .rec { border: 1px solid #e5e7eb; border-left: 4px solid #6366f1; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; page-break-inside: avoid; }
  .rec p { margin: 4px 0; }
  .rec-head { display: flex; gap: 8px; align-items: center; }
  .rec-head .gain { margin-left: auto; font-weight: bold; color: #4f46e5; }
  .badge { font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 4px; color: #fff; }
  .badge.critical { background: #dc2626; } .badge.important { background: #f59e0b; } .badge.minor { background: #6b7280; }
  .block { margin-bottom: 16px; page-break-inside: avoid; }
  .block-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 6px; }
  .pill { font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 10px; background: #f3f4f6; }
  table { width: 100%; border-collapse: collapse; }
  .checks td { padding: 6px 4px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  .checks .icon { width: 22px; font-weight: bold; font-size: 14px; }
  .icon.pass, .icon.na { color: #16a34a; } .icon.partial { color: #f59e0b; } .icon.fail { color: #dc2626; }
  .checks .pts { width: 80px; text-align: right; white-space: nowrap; color: #374151; }
  .evidence { color: #6b7280; font-size: 11px; }
  .pages th, .pages td { text-align: left; padding: 6px 4px; border-bottom: 1px solid #e5e7eb; font-size: 11px; word-break: break-all; }
  .page-break { page-break-before: always; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 10px; }
  .support { margin: 18px 0; padding: 12px; border-radius: 8px; background: #eef2ff; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div>
      ${logo ? `<img src="${escapeHtml(logo)}" alt="Logo" />` : ''}
      <div class="eyebrow">${escapeHtml(brand)}</div>
      <h1>AEO &amp; GEO Readiness Report</h1>
      <div class="muted">${escapeHtml(report.url)}</div>
    </div>
    <div class="muted" style="text-align:right">Generated<br>${escapeHtml(formatDate(report.generatedAt))}</div>
  </div>

  <div class="hero">
    <div class="score ${tone(report.overall)}"><strong>${report.overall}</strong><span>/ 100</span></div>
    <div>
      <h2 style="margin-top:0">Overall AI Readiness: ${escapeHtml(report.verdict)}</h2>
      <p>${escapeHtml(report.summary)}</p>
      <p class="muted">AI Crawler Access: ${report.crawlerAccess.allowed} of ${report.crawlerAccess.total} key AI crawlers can access your site · ${report.pages.length} page${report.pages.length === 1 ? '' : 's'} analysed</p>
    </div>
  </div>

  <h2>Category Scores</h2>
  <div class="cards">${categoryCards}</div>
  ${categoryBars}

  <h2>Top Recommendations</h2>
  ${recommendations || '<p>No major issues found. Great work!</p>'}

  ${pagesTable}

  <div class="page-break">
    <h2>Detailed Check Results${report.pages.length > 1 ? ' (Homepage and Site-wide)' : ''}</h2>
    ${CATEGORY_IDS.map((id) => categoryTable(id, home?.categories[id] ?? report.categories[id], homeChecks)).join('')}
  </div>

  ${otherPages ? `<div class="page-break"><h2>Issues on Other Pages</h2>${otherPages}</div>` : ''}

  ${aiSection}

  ${supportUrl ? `<div class="support">
    <strong>This report is free.</strong> If it helped you, support the project so we can keep it free for everyone: ${escapeHtml(supportUrl)}
  </div>` : ''}
  <div class="footer">Report by ${escapeHtml(brand)} · Generated ${escapeHtml(formatDate(report.generatedAt))} · Re-run any time for a fresh report.</div>
</body>
</html>`;
}
