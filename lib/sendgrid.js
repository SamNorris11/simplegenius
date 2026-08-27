// SendGrid mail sender for the "Brief Ready" email only.
//
// Why this exists: ActiveCampaign's merge-tag engine does not resolve
// custom-field tags inside HTML attribute values in raw Custom HTML blocks
// (confirmed via a live test — %BRIEF_PDF_URL% never resolved in the href,
// while system tags like %FIRSTNAME% resolved fine elsewhere in the same
// email). Routing this one email through SendGrid with the real values
// already interpolated server-side (see lib/brief-email-template.js)
// sidesteps that limitation completely — there is nothing left for any
// template engine to fail to substitute.
//
// AC continues to own everything else: contact upsert, custom fields, the
// "Brief Ready" tag, and the CRM record (see lib/activecampaign.js). This
// module ONLY sends the one email. Best-effort by design — never throws;
// callers should treat a failed send the same way AC sync failures are
// treated: log it, but never let it block marking the job DELIVERED.

const { renderBriefReadyEmail } = require('./brief-email-template');

const FROM_EMAIL = process.env.BRIEF_EMAIL_FROM || 'hello@simplegenius.com';
const FROM_NAME = process.env.BRIEF_EMAIL_FROM_NAME || 'Simple Genius';

function getConfig() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return null;
  return { apiKey };
}

/**
 * Sends the "Brief Ready" email directly via SendGrid's API with the PDF
 * URL and first name already baked in as literal text.
 *
 * Never throws — logs and returns { ok: false, error } instead so the
 * caller can record it without failing the whole job.
 */
async function sendBriefReadyEmail({ email, firstName, pdfUrl }) {
  const config = getConfig();
  if (!config) {
    return { ok: false, skipped: true, error: 'SENDGRID_API_KEY not configured' };
  }
  if (!email || !pdfUrl) {
    return { ok: false, error: 'email and pdfUrl are required' };
  }

  const { subject, html, text } = renderBriefReadyEmail({ firstName, pdfUrl, email });

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        reply_to: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    });

    if (res.status === 202) {
      return { ok: true, messageId: res.headers.get('x-message-id') || null };
    }

    const bodyText = await res.text().catch(() => '');
    console.error(`SendGrid send failed (${res.status}):`, bodyText.slice(0, 1000));
    return { ok: false, error: `SendGrid ${res.status}: ${bodyText}`.slice(0, 1000) };
  } catch (err) {
    console.error('SendGrid send threw (non-blocking):', err);
    return { ok: false, error: String(err.message || err).slice(0, 500) };
  }
}

module.exports = { sendBriefReadyEmail };
