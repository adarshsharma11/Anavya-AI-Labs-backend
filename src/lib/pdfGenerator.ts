import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

import os from 'os';

export type PdfBranding = {
  companyName?: string;
  companyLogoUrl?: string;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeLogoUrl = (value?: string) => {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
};

const list = (items: unknown) => {
  if (!Array.isArray(items) || items.length === 0) return '';
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
};

const paragraphs = (text: unknown) =>
  String(text ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

const section = (title: string, body: string) =>
  body ? `<div class="section"><h3>${escapeHtml(title)}</h3>${body}</div>` : '';

const metricCard = (label: string, value: unknown) =>
  `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? 'N/A')}</strong></div>`;

const buildHtml = (scan: any, branding: PdfBranding) => {
  const preview = scan.preview ?? {};
  const report = scan.fullReport ?? {};
  const geo = preview.geo;
  const companyName = branding.companyName || 'Anavya AI Labs';
  const logoUrl = safeLogoUrl(branding.companyLogoUrl);
  const cwv = preview.metrics?.coreWebVitals;

  const issues = (preview.allIssues ?? preview.topIssues ?? []).map(
    (issue: any) => `${issue.title} (${issue.severity})`,
  );

  const geoSection = geo
    ? `
      <div class="metric-grid">
        ${metricCard('GEO Score', `${geo.score?.value ?? 'N/A'}/${geo.score?.max ?? 100}`)}
        ${metricCard('AI Crawlers Allowed', geo.checks?.robotsAllowed ? 'Yes' : 'No')}
        ${metricCard('llms.txt', geo.checks?.llmsTxt ? 'Present' : 'Missing')}
        ${metricCard('Schema', geo.checks?.schema ? 'Present' : 'Missing')}
      </div>
      ${list((geo.recommendations ?? []).map((rec: any) => `${rec.title}: ${rec.description}`))}`
    : '';

  const vitals = cwv
    ? `<div class="metric-grid">
        ${metricCard('Mobile Performance', cwv.performanceScore)}
        ${metricCard('LCP', cwv.lab?.lcpMs ? `${(cwv.lab.lcpMs / 1000).toFixed(1)}s` : 'N/A')}
        ${metricCard('CLS', cwv.lab?.cls ?? 'N/A')}
        ${metricCard('INP (real users)', cwv.field?.inpMs ? `${cwv.field.inpMs}ms` : 'No field data')}
      </div>`
    : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Audit Report: ${escapeHtml(scan.url)}</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #333; font-size: 13px; line-height: 1.5; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eaeaea; padding-bottom: 20px; margin-bottom: 30px; }
        .branding h1 { margin: 0; font-size: 24px; color: #111; }
        .branding img { max-height: 50px; margin-bottom: 10px; }
        .title { text-align: right; }
        .title h2 { margin: 0; font-size: 20px; color: #555; }
        .title p { margin: 5px 0 0; color: #888; word-break: break-all; }
        .section { margin-bottom: 28px; page-break-inside: avoid; }
        .section h3 { border-bottom: 1px solid #ddd; padding-bottom: 5px; color: #111; }
        .metric-grid { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 12px; }
        .metric-card { flex: 1 1 140px; background: #f9f9f9; padding: 12px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .metric-card span { display: block; font-size: 12px; color: #666; margin-bottom: 4px; }
        .metric-card strong { font-size: 18px; color: #222; }
        li { margin-bottom: 6px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="branding">
          ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" />` : ''}
          <h1>${escapeHtml(companyName)}</h1>
        </div>
        <div class="title">
          <h2>Website Audit Report</h2>
          <p>${escapeHtml(scan.url)}</p>
        </div>
      </div>

      ${section('Executive Summary', paragraphs(report.executiveSummary))}

      <div class="section">
        <h3>Overview</h3>
        <div class="metric-grid">
          ${metricCard('Overall Score', `${preview.overall ?? 'N/A'}/100`)}
          ${metricCard('Verdict', preview.verdict)}
          ${metricCard('Issues Found', preview.totalIssuesFound ?? 0)}
          ${metricCard('Performance', preview.categories?.performance)}
          ${metricCard('SEO', preview.categories?.seo)}
          ${metricCard('Accessibility', preview.categories?.accessibility)}
          ${metricCard('Security', preview.categories?.security)}
        </div>
        ${vitals}
      </div>

      ${section('All Issues Found', list(issues))}
      ${section('Technical Analysis', paragraphs(report.technicalAnalysis))}
      ${section('SEO Improvements', list(report.seoImprovements))}
      ${section('Performance Improvements', list(report.performanceImprovements))}
      ${section('AI Search Visibility (GEO)', geoSection + list(report.geoImprovements))}
      ${section('Business Growth Suggestions', list(report.businessGrowthSuggestions))}
      ${section('Competitor Strategy', paragraphs(report.competitorStrategy))}
      ${section('Estimated Traffic Impact', paragraphs(report.estimatedTrafficImpact))}

      <div class="section">
        <p style="text-align:center; color:#888; font-size: 11px; margin-top: 40px;">Generated by ${escapeHtml(companyName)}.</p>
      </div>
    </body>
    </html>
  `;
};

export const generatePdfReport = async (scan: any, branding: PdfBranding = {}): Promise<Buffer> => {
  const htmlContent = buildHtml(scan, branding);

  // Always use local chrome on Windows / macOS. Use Sparticuz only in Linux environments (like Vercel production).
  const isWindows = os.platform() === 'win32';
  const isMac = os.platform() === 'darwin';

  let executablePath: string;

  if (isWindows) {
    executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  } else if (isMac) {
    executablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  } else {
    // Linux / Production
    executablePath = await chromium.executablePath();
  }

  const browser = await puppeteer.launch({
    args: isWindows || isMac ? [] : chromium.args,
    defaultViewport: { width: 1920, height: 1080 },
    executablePath: executablePath || undefined,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
};
