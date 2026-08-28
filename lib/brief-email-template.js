// "Brief Ready" email template — rendered server-side with real values baked
// in as literal text (no merge tags of any kind). This exists specifically
// because ActiveCampaign's merge-tag engine does not resolve custom-field
// tags (e.g. %BRIEF_PDF_URL%) inside HTML attribute values in raw Custom
// HTML blocks — confirmed via a live send test. Routing this one email
// through SendGrid with pre-baked values sidesteps that limitation entirely.
//
// Visual design intentionally matches the AC template Sam already approved
// (charcoal #1D1D1D, gold #D4AF37, Arial body) so the email looks identical
// to what he already signed off on.

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBriefReadyEmail({ firstName, pdfUrl, email }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const safePdfUrl = escapeHtml(pdfUrl || '');
  const safeEmail = escapeHtml(email || '');

  const subject = 'Your Competitive Landscape Brief is ready';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${subject}</title>
</head>
<body style="font-family:Arial, Helvetica, sans-serif;width:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;margin:0;background-color:#FFFFFF">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">See how you compare, in your own words and theirs.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#F7F7F7">
<tr><td align="center" style="padding:32px 16px;margin:0">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:560px;width:100%;background-color:#FFFFFF">
<tr><td style="padding:0;margin:0;background-color:#D4AF37;height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
<tr><td align="center" style="padding:32px 32px 8px;margin:0">
<img src="https://www.simplegenius.com/img/logo-dark-112h.png" width="150" height="56" alt="Simple Genius" style="display:block;border:0;outline:none;text-decoration:none">
</td></tr>
<tr><td style="padding:24px 40px 8px;margin:0">
<p style="margin:0 0 20px 0;font-family:Arial, Helvetica, sans-serif;line-height:26px;color:#1D1D1D;font-size:16px">Hi ${safeFirstName},</p>
<p style="margin:0 0 20px 0;font-family:Arial, Helvetica, sans-serif;line-height:26px;color:#1D1D1D;font-size:16px">Your Competitive Landscape Brief is ready.</p>
<p style="margin:0 0 28px 0;font-family:Arial, Helvetica, sans-serif;line-height:26px;color:#1D1D1D;font-size:16px">It shows what we found about your business, what we found about your competitors, and what we think you should do next using only publicly available information.</p>
</td></tr>
<tr><td align="center" style="padding:0 40px 32px;margin:0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
<tr><td align="center" style="padding:0;margin:0;background-color:#1D1D1D;border-radius:4px">
<a href="${safePdfUrl}" target="_blank" style="text-decoration:none;color:#D4AF37;font-size:16px;display:inline-block;padding:16px 36px;font-family:Arial, Helvetica, sans-serif;font-weight:bold;border-radius:4px">Download Your Brief</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 40px;margin:0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
<tr><td style="padding:0;margin:0;border-top:1px solid #E5E3DD;font-size:0;line-height:0">&nbsp;</td></tr>
</table>
</td></tr>
<tr><td style="padding:28px 40px 8px;margin:0">
<p style="margin:0 0 24px 0;font-family:Arial, Helvetica, sans-serif;line-height:24px;color:#5A5A5A;font-size:15px">If a question comes up while you are reading it, just reply to this email. A real person reads these.</p>
<p style="margin:0 0 4px 0;font-family:Arial, Helvetica, sans-serif;line-height:24px;color:#1D1D1D;font-size:15px">Simple Genius</p>
</td></tr>
<tr><td align="center" style="padding:4px 40px 40px;margin:0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
<tr><td align="center" style="padding:0;margin:0;background-color:#D4AF37;border-radius:4px">
<a href="https://www.simplegenius.com" target="_blank" style="text-decoration:none;color:#1D1D1D;font-size:15px;display:inline-block;padding:14px 32px;font-family:Arial, Helvetica, sans-serif;font-weight:bold;border-radius:4px">Let's talk</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 40px;margin:0;background-color:#1D1D1D">
<p style="margin:0;font-family:Arial, Helvetica, sans-serif;line-height:18px;color:#8A8A8A;font-size:12px;text-align:center">Simple Genius &middot; The first step in AI for business<br><a href="https://www.simplegenius.com" style="text-decoration:underline;color:#8A8A8A;font-size:14px">simplegenius.com</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `Hi ${firstName || 'there'},

Your Competitive Landscape Brief is ready.

It shows what we found about your business, what we found about your competitors, and what we think you should do next using only publicly available information.

Download it here: ${pdfUrl}

If a question comes up while you are reading it, just reply to this email. A real person reads these.

Simple Genius
https://www.simplegenius.com`;

  return { subject, html, text, safeEmail };
}

module.exports = { renderBriefReadyEmail };
