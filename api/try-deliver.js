// POST /api/try-deliver { jobId }
// Final stage: render the PDF, upload to Blob, deliver via ActiveCampaign.
// STUB — PDF/AC delivery is not built yet. Until it is, any job that reaches
// this stage is parked at NEEDS_REVIEW (never silently marked DELIVERED, and
// never emailed) so nothing gets lost or half-sent.
const { query } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const jobId = req.body?.jobId || (typeof req.body === 'string' ? JSON.parse(req.body).jobId : null);
  if (!jobId) return res.status(400).json({ ok: false, error: 'jobId required' });

  await query(
    `UPDATE brief_jobs SET status = 'NEEDS_REVIEW', last_error = $2, updated_at = now() WHERE id = $1 AND status = 'GENERATING_PDF'`,
    [jobId, 'PDF generation / AC delivery not implemented yet.']
  );

  return res.status(202).json({ ok: true, jobId, note: 'PDF/delivery stage not implemented yet.' });
};
