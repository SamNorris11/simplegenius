// GET /api/try-status?jobId=...
// Read-only status lookup. Returns pipeline status and stage counts only —
// never returns raw research/synthesis/insights content or PII beyond email.
const { query } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const jobId = req.query?.jobId;
  if (!jobId) return res.status(400).json({ ok: false, error: 'jobId required' });

  const { rows } = await query(
    `SELECT id, status, attempts, last_error, created_at, updated_at,
            (research_target IS NOT NULL) AS has_research_target,
            (research_competitor1 IS NOT NULL) AS has_research_competitor1,
            (research_competitor2 IS NOT NULL) AS has_research_competitor2,
            (synthesis IS NOT NULL) AS has_synthesis,
            (insights IS NOT NULL) AS has_insights,
            qc_result, pdf_url, delivered_at
     FROM brief_jobs WHERE id = $1`,
    [jobId]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: 'not found' });
  return res.status(200).json({ ok: true, job: rows[0] });
};
