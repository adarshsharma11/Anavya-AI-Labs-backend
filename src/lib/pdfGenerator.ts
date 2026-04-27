import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

import os from 'os';

export const generatePdfReport = async (scan: any, companyName?: string, companyLogoUrl?: string): Promise<Buffer> => {
  // Simple HTML structure with branding and scan data
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Audit Report: ${scan.url}</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #333; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eaeaea; padding-bottom: 20px; margin-bottom: 30px; }
        .branding h1 { margin: 0; font-size: 24px; color: #111; }
        .branding img { max-height: 50px; margin-bottom: 10px; }
        .title { text-align: right; }
        .title h2 { margin: 0; font-size: 20px; color: #555; }
        .title p { margin: 5px 0 0; color: #888; }
        .section { margin-bottom: 30px; }
        .section h3 { border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        .metric-grid { display: flex; flex-wrap: wrap; gap: 20px; }
        .metric-card { flex: 1 1 200px; background: #f9f9f9; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .metric-card span { display: block; font-size: 14px; color: #666; margin-bottom: 5px; }
        .metric-card strong { font-size: 22px; color: #222; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="branding">
          ${companyLogoUrl ? `<img src="${companyLogoUrl}" alt="Logo" />` : ''}
          ${companyName ? `<h1>${companyName}</h1>` : '<h1>SEO Audit Report</h1>'}
        </div>
        <div class="title">
          <h2>Website Analysis</h2>
          <p>${scan.url}</p>
        </div>
      </div>

      <div class="section">
        <h3>Overview</h3>
        <div class="metric-grid">
          <div class="metric-card"><span>Overall Score</span><strong>${scan.preview?.overall || 'N/A'}/100</strong></div>
          <div class="metric-card"><span>Verdict</span><strong>${scan.preview?.verdict || 'N/A'}</strong></div>
          <div class="metric-card"><span>Issues Found</span><strong>${scan.preview?.totalIssuesFound || '0'}</strong></div>
        </div>
      </div>

      <div class="section">
        <h3>Categories</h3>
        <div class="metric-grid">
          <div class="metric-card"><span>Performance</span><strong>${scan.preview?.categories?.performance || 'N/A'}</strong></div>
          <div class="metric-card"><span>SEO</span><strong>${scan.preview?.categories?.seo || 'N/A'}</strong></div>
          <div class="metric-card"><span>Accessibility</span><strong>${scan.preview?.categories?.accessibility || 'N/A'}</strong></div>
          <div class="metric-card"><span>Security</span><strong>${scan.preview?.categories?.security || 'N/A'}</strong></div>
        </div>
      </div>
      
      <div class="section">
        <p style="text-align:center; color:#888; font-size: 12px; margin-top: 50px;">Generated automatically by ${companyName || 'Anavya AI Labs'}.</p>
      </div>
    </body>
    </html>
  `;

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

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  
  await browser.close();

  // Return buffer as Uint8Array
  return Buffer.from(pdfBuffer);
};
