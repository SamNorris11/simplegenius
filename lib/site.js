// Shared site-detection + attribution constants.
// Used by every form/webhook endpoint so consulting.simplegenius.com and
// simplegenius.com leads land in the same CRM/AC account but stay
// unmistakably distinguishable (tags + a visible Description/Prospect
// Source Detail line — Lead_Source1 itself intentionally stays
// 'Website Direct' for both, per decision).

const SITE_TAGS = {
  zoho: { consulting: 'site-consulting', production: 'site-production' },
  ac: { consulting: 'Site: Consulting', production: 'Site: Production' }
};

const SITE_LABELS = {
  consulting: 'consulting.simplegenius.com',
  production: 'simplegenius.com'
};

const SITE_BASE_URLS = {
  consulting: 'https://consulting.simplegenius.com',
  production: 'https://www.simplegenius.com'
};

function detectSite(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  return host.includes('consulting.simplegenius.com') ? 'consulting' : 'production';
}

// First-line-of-Description helper so the site of origin is unmissable
// without adding a new Zoho picklist value.
function siteSourceLine(siteKey) {
  return `Website Source: ${SITE_LABELS[siteKey] || SITE_LABELS.production}`;
}

module.exports = { detectSite, SITE_TAGS, SITE_LABELS, SITE_BASE_URLS, siteSourceLine };
