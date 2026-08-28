// POST /api/report-viewer-error
// Fired automatically by report.html when the in-page PDF renderer fails
// in a visitor's real browser. Lets us see exactly what broke (browser,
// error name/message) without needing the visitor to send a screenshot.
// Best-effort only: never throws, never blocks the visitor's fallback view.
const { query } = require('../lib/db');

let tableEnsured = false;
async function ensureTable() {
  if (tableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS viewer_errors (
      id             SERIAL PRIMARY KEY,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      pdf_url        TEXT,
      user_agent     TEXT,
      error_name     TEXT,
      error_message  TEXT,
      error_stack    TEXT,
      stage          TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_viewer_errors_created_at ON viewer_errors (created_at);
  `);
  tableEnsured = true;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const pdfUrl = String(body.pdfUrl || '').slice(0, 500);
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);
    const errorName = String(body.errorName || '').slice(0, 200);
    const errorMessage = String(body.errorMessage || '').slice(0, 1000);
    const errorStack = String(body.errorStack || '').slice(0, 4000);
    const stage = String(body.stage || '').slice(0, 100);

    await ensureTable();
    await query(
      `INSERT INTO viewer_errors (pdf_url, user_agent, error_name, error_message, error_stack, stage, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [pdfUrl, userAgent, errorName, errorMessage, errorStack, stage]
    );
  } catch (e) {
    // Never let diagnostics logging break the visitor's page.
    console.error('report-viewer-error logging failed:', e && e.message);
  }

  // 204 no matter what — this is fire-and-forget from the client.
  return res.status(204).end();
};
