// Serverless-compatible PDF rendering via headless Chromium.
// Uses @sparticuz/chromium (a Chromium binary packaged for AWS Lambda / Vercel
// Node serverless functions) + puppeteer-core (no bundled browser download).
// All template assets (fonts, logos) are inlined as data URIs in the HTML string
// itself (see lib/pdf-template.js), so no filesystem or network access is needed
// at render time beyond launching the browser.

const VIEWPORT = {
  deviceScaleFactor: 1,
  hasTouch: false,
  height: 1080,
  isLandscape: true,
  isMobile: false,
  width: 1920,
};

/**
 * Render an HTML string to a PDF buffer using headless Chromium.
 * @param {string} html - full, self-contained HTML document (inline CSS/fonts/images)
 * @returns {Promise<Buffer>} PDF file bytes, US Letter, no margins (page size is
 *   set by the template's own @page CSS rule)
 */
async function renderPdfFromHtml(html) {
  // Required lazily (not at module top-level) so that any resolution/load
  // failure surfaces as a normal catchable error inside this function's
  // try/catch, instead of crashing module load and producing an opaque
  // Vercel FUNCTION_INVOCATION_FAILED with no diagnostic message.
  const chromium = require('@sparticuz/chromium').default;
  const puppeteer = require('puppeteer-core');

  let browser;
  try {
    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
      defaultViewport: VIEWPORT,
      executablePath,
      headless: 'shell',
    });

    const page = await browser.newPage();
    // waitUntil networkidle0 is unnecessary since everything is inlined (data URIs),
    // but 'load' ensures the DOM + inline resources have fully parsed.
    await page.setContent(html, { waitUntil: 'load', timeout: 45000 });

    // Give web font rendering a moment to settle even though fonts are embedded
    // as data URIs (Chromium still needs to parse/apply @font-face before paint).
    await page.evaluateHandle('document.fonts.ready');

    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });

    return pdfBuffer;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { renderPdfFromHtml };
