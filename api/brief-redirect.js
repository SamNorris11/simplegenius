// GET /api/brief-redirect?dest=...
//
// Workaround for an ActiveCampaign platform limitation: AC's click-tracking
// system cannot resolve a personalization tag when it is used as the ENTIRE
// href value (confirmed via AC's own docs: "we cannot track a link click
// action that uses ... a personalization tag in place of a URL"). Putting
// %BRIEF_PDF_URL% directly as href="%BRIEF_PDF_URL%" gets registered as a
// literal, unresolved link and either 400s (tracking on) or never becomes
// clickable (tracking off).
//
// Fix: the email button links here instead, with %BRIEF_PDF_URL% passed as
// a normal query-string VALUE (a pattern AC's own docs confirm resolves
// correctly, same as their documented %EMAIL%/%FIRSTNAME% form-prefill
// examples) rather than as the entire href. This endpoint does a pure
// validate-and-redirect — no database or ActiveCampaign lookups, no PII
// (email, name, company) ever touches this endpoint or its logs.
//
// Only redirects to our own known PDF storage host, to prevent this from
// being usable as an open redirect.

const ALLOWED_HOST_SUFFIX = '.public.blob.vercel-storage.com';

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method not allowed');
  }

  const dest = req.query?.dest;
  if (!dest || typeof dest !== 'string') {
    return res.status(400).send('Missing dest parameter.');
  }

  let parsed;
  try {
    parsed = new URL(dest);
  } catch (e) {
    return res.status(400).send('Invalid brief link.');
  }

  const hostOk =
    parsed.protocol === 'https:' &&
    parsed.hostname.endsWith(ALLOWED_HOST_SUFFIX);

  if (!hostOk) {
    console.error('brief-redirect: rejected non-allowlisted destination host', parsed.hostname);
    return res.status(400).send('This link is not valid. Please reply to the email you received and we will send your brief directly.');
  }

  res.writeHead(302, { Location: parsed.toString() });
  return res.end();
};
