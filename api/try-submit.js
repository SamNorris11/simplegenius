// POST /api/try-submit
// Validates the /try form, creates a brief_jobs row, kicks off the async
// research pipeline (does not wait for it), responds immediately.
const crypto = require('crypto');
const { waitUntil } = require('@vercel/functions');
const { query } = require('../lib/db');

function trimTrailingSlash(s) {
  return typeof s === 'string' ? s.replace(/\/+$/, '') : s;
}

function normalizeUrl(v) {
  if (!v) return '';
  const trimmed = v.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimTrailingSlash(trimmed);
  return trimTrailingSlash(`https://${trimmed}`);
}

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return trimTrailingSlash(process.env.PUBLIC_BASE_URL);
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const required = ['firstName', 'lastName', 'email', 'company', 'website', 'competitor1Name', 'competitor1Site', 'competitor2Name', 'competitor2Site'];
  const missing = required.filter((k) => !body[k] || !String(body[k]).trim());
  if (missing.length) {
    return res.status(400).json({ ok: false, error: `Missing required fields: ${missing.join(', ')}` });
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim());
  if (!emailOk) {
    return res.status(400).json({ ok: false, error: 'Invalid email address.' });
  }

  const id = crypto.randomUUID();
  const params = [
    id,
    String(body.firstName).trim(),
    String(body.lastName).trim(),
    String(body.email).trim().toLowerCase(),
    body.role ? String(body.role).trim() : null,
    String(body.company).trim(),
    normalizeUrl(body.website),
    body.socials ? String(body.socials).trim() : null,
    String(body.competitor1Name).trim(),
    normalizeUrl(body.competitor1Site),
    String(body.competitor2Name).trim(),
    normalizeUrl(body.competitor2Site),
    body.utm_source || null,
    body.utm_medium || null,
    body.utm_campaign || null,
    body.page_url || null,
    body.referrer || null
  ];

  try {
    await query(
      `INSERT INTO brief_jobs (
        id, first_name, last_name, email, role, company, website, socials,
        competitor1_name, competitor1_site, competitor2_name, competitor2_site,
        utm_source, utm_medium, utm_campaign, page_url, referrer, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'SUBMITTED')`,
      params
    );
  } catch (err) {
    console.error('try-submit insert failed', err);
    return res.status(500).json({ ok: false, error: 'Could not save your submission. Please try again in a minute.' });
  }

  // Kick off the pipeline without making the browser wait for it.
  const url = `${baseUrl(req)}/api/try-process`;
  const kickoff = fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId: id })
  }).catch((err) => console.error('try-process kickoff failed', err));
  waitUntil(kickoff);

  return res.status(202).json({ ok: true, jobId: id });
};
