// POST /api/try-deliver { jobId }
// Final stage: render the PDF from the job's real research/synthesis/insights
// data, upload it to Vercel Blob, sync ActiveCampaign (best-effort), and mark
// the job DELIVERED. Never silently loses a job — any failure parks the job
// at NEEDS_REVIEW with last_error set instead of leaving it stuck or
// pretending it succeeded.
// Requires are wrapped so that a resolution/load failure for any dependency
// (e.g. a bundling issue with the Chromium binary) surfaces as a normal JSON
// error response instead of an opaque Vercel FUNCTION_INVOCATION_FAILED page
// with no diagnostic information.
let put, query, renderBriefHtml, renderPdfFromHtml, syncBriefDelivered, sendBriefReadyEmail, requireError;
try {
  put = require('@vercel/blob').put;
  query = require('../lib/db').query;
  renderBriefHtml = require('../lib/pdf-template').renderBriefHtml;
  renderPdfFromHtml = require('../lib/pdf-render').renderPdfFromHtml;
  syncBriefDelivered = require('../lib/activecampaign').syncBriefDelivered;
  sendBriefReadyEmail = require('../lib/sendgrid').sendBriefReadyEmail;
} catch (err) {
  requireError = err;
  console.error('try-deliver: module load failed', err);
}

async function getJob(id) {
  const { rows } = await query('SELECT * FROM brief_jobs WHERE id = $1', [id]);
  return rows[0] || null;
}

async function markNeedsReview(jobId, message) {
  await query(
    `UPDATE brief_jobs SET status = 'NEEDS_REVIEW', last_error = $2, updated_at = now() WHERE id = $1`,
    [jobId, String(message || '').slice(0, 1000)]
  );
}

async function markDelivered(jobId, pdfUrl) {
  await query(
    `UPDATE brief_jobs SET status = 'DELIVERED', pdf_url = $2, delivered_at = now(), updated_at = now() WHERE id = $1`,
    [jobId, pdfUrl]
  );
}

module.exports = async (req, res) => {
  if (requireError) {
    return res.status(500).json({ ok: false, error: `module load failed: ${String(requireError?.stack || requireError)}`.slice(0, 4000) });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let jobId, job;
  try {
    jobId = req.body?.jobId || (typeof req.body === 'string' ? JSON.parse(req.body).jobId : null);
    if (!jobId) return res.status(400).json({ ok: false, error: 'jobId required' });

    job = await getJob(jobId);
    if (!job) return res.status(404).json({ ok: false, error: 'job not found' });
  } catch (err) {
    console.error('try-deliver: failed reading request/job', err);
    return res.status(500).json({ ok: false, error: `request/job lookup failed: ${String(err?.stack || err)}`.slice(0, 4000) });
  }

  // Idempotency: only act on jobs actually waiting for PDF generation. A job
  // that's already DELIVERED or elsewhere in the pipeline should not be
  // re-rendered/re-delivered by a duplicate or retried call.
  if (job.status !== 'GENERATING_PDF') {
    return res.status(200).json({ ok: true, jobId, status: job.status, note: 'no-op: job is not awaiting PDF generation' });
  }

  try {
    // 1. Render the self-contained HTML for this job's real data. Company/
    //    competitor names come from the job row itself (never from LLM
    //    output), so there is zero risk of one company's identity leaking
    //    into another company's brief.
    const html = renderBriefHtml(job);

    // 2. Render to PDF via headless Chromium.
    const pdfBuffer = await renderPdfFromHtml(html);

    // 3. Upload to Vercel Blob.
    const filenameSafeCompany = String(job.company || 'brief')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'brief';
    const blob = await put(`briefs/${jobId}-${filenameSafeCompany}.pdf`, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
      addRandomSuffix: false,
    });

    // 4. Mark delivered FIRST — the PDF existing and being recorded is the
    //    part that must never be lost. ActiveCampaign sync is a secondary,
    //    best-effort side effect and must not be able to undo this.
    await markDelivered(jobId, blob.url);

    // 5. Best-effort ActiveCampaign sync (contact upsert + custom field +
    //    tag). Sam hasn't built the AC automation yet, so this just
    //    prepares the contact/tag/field state for when he does. Never
    //    throws — logs and continues either way.
    const acResult = await syncBriefDelivered({
      email: job.email,
      firstName: job.first_name,
      lastName: job.last_name,
      pdfUrl: blob.url,
      company: job.company,
    });
    if (!acResult.ok && !acResult.skipped) {
      console.error(`job ${jobId} delivered but AC sync failed:`, acResult.error);
    }

    // 6. Send the "Brief Ready" email directly via SendGrid with the real
    //    PDF URL baked in as literal text. AC's merge-tag engine does not
    //    resolve custom-field tags inside href attributes in raw Custom
    //    HTML blocks (confirmed via a live test), so AC no longer sends
    //    this specific email — it still owns the contact/field/tag sync
    //    above. Best-effort: never blocks marking the job DELIVERED.
    const emailResult = await sendBriefReadyEmail({
      email: job.email,
      firstName: job.first_name,
      pdfUrl: blob.url,
    });
    if (!emailResult.ok && !emailResult.skipped) {
      console.error(`job ${jobId} delivered but Brief Ready email failed:`, emailResult.error);
    }

    return res.status(200).json({
      ok: true,
      jobId,
      status: 'DELIVERED',
      pdfUrl: blob.url,
      activeCampaign: acResult,
      email: emailResult,
    });
  } catch (err) {
    console.error(`job ${jobId} failed during PDF/delivery stage`, err);
    await markNeedsReview(jobId, `PDF/delivery failed: ${String(err?.message || err)}`).catch((e2) =>
      console.error('markNeedsReview also failed', e2)
    );
    return res.status(500).json({ ok: false, jobId, error: String(err?.stack || err).slice(0, 4000) });
  }
};
