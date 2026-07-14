const { certificateTemplate } = require('../../lib/certificateTemplate');
const { uploadToDrive } = require('../../lib/googleDrive');
const { uploadToFtp } = require('../../lib/ftpUpload');

export const config = {
  api: {
    bodyParser: { sizeLimit: '1mb' },
  },
  maxDuration: 60, // allow enough time to connect to Browserless and render
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  const row = req.body;
  if (!row || typeof row !== 'object') {
    return res.status(400).json({ error: 'Missing row data' });
  }

  const html = certificateTemplate(row);

  let browser;
  try {
    const puppeteer = require('puppeteer-core');

    if (process.env.VERCEL) {
      // Production on Vercel: connect to Browserless's hosted Chrome instead
      // of launching our own inside the serverless function. We tried
      // running Chromium directly in Vercel's environment three different
      // ways (bundled binary, self-hosted pack, GitHub-hosted pack) and hit
      // the same "libnss3.so" shared-library error every time — that's a
      // Vercel runtime-environment issue, not something fixable from our
      // code. Browserless removes the problem entirely: Vercel just makes a
      // WebSocket connection to an already-running browser elsewhere.
      if (!process.env.BROWSERLESS_TOKEN) {
        throw new Error('BROWSERLESS_TOKEN environment variable is not set');
      }
      browser = await puppeteer.connect({
        browserWSEndpoint: `wss://production-sfo.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`,
      });
    } else {
      // Local dev: use full puppeteer (auto-downloads its own Chromium)
      const localPuppeteer = require('puppeteer');
      browser = await localPuppeteer.launch({ headless: 'new' });
    }

    const page = await browser.newPage();
    // Our certificate HTML is fully self-contained (base64-embedded logo,
    // no external images/fonts/scripts), so there's no real network
    // activity to wait for. "networkidle0" was timing out after 30s in
    // Browserless's environment for reasons unrelated to our content —
    // "domcontentloaded" is the correct, faster condition here.
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });

    const filename = `CAL-CERT-${(row.serialNo || 'unknown').toString().replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`;
    const buffer = Buffer.from(pdfBuffer);

    // Fire off the Drive upload but don't let a Drive failure block the
    // person's local download — log it and let the response go through.
    let driveResult = { skipped: true };
    try {
      driveResult = await uploadToDrive(buffer, filename);
    } catch (driveErr) {
      console.error('Google Drive upload failed:', driveErr);
      driveResult = { skipped: true, error: driveErr.message };
    }

    // Same non-blocking pattern for FTP: try it, but never let it stop the
    // person from getting their local download.
    let ftpResult = { skipped: true };
    try {
      ftpResult = await uploadToFtp(buffer, filename);
    } catch (ftpErr) {
      console.error('FTP upload failed:', ftpErr);
      ftpResult = { skipped: true, error: ftpErr.message };
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Drive-Status', driveResult.skipped ? 'skipped' : 'uploaded');
    res.setHeader('X-Ftp-Status', ftpResult.skipped ? 'skipped' : 'uploaded');
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('PDF generation failed:', err);
    return res.status(500).json({ error: 'PDF generation failed', details: err.message });
  } finally {
    if (browser) await browser.close();
  }
}
