// Shared Zoho lead helpers for website conversion forms.
// Keeps CRM creation independent from ActiveCampaign so a marketing sync
// cannot strip business details or website attribution.

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function normalizeUrl(value) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

function setIfPresent(record, key, value) {
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    record[key] = value;
  }
}

function zohoFetch(url, options = {}) {
  const configured = Number(process.env.ZOHO_FETCH_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configured) && configured > 0 ? configured : 8000;
  return fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(timeoutMs)
  });
}

function formatVisitDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value)) + ' ET';
  } catch (e) {
    return String(value);
  }
}

function formatVisitSummary(value, conversionLabel) {
  if (!value) return '';
  try {
    const summary = typeof value === 'string' ? JSON.parse(value) : value;
    const pageViews = Number(summary.pageViews) || 1;
    const sessions = Number(summary.sessionCount) || 1;
    const days = Number(summary.daysVisited) || 1;
    const firstVisit = formatVisitDate(summary.firstVisit);
    const lastVisit = formatVisitDate(summary.lastVisit);
    const landingPage = String(summary.landingPage || '/').slice(0, 500);
    const action = conversionLabel || 'submitting the form';
    const paragraphs = [
      `This visitor first arrived on ${firstVisit || 'an unknown date'} at ${landingPage}. ` +
      `Before ${action}, they viewed ${pageViews} ${pageViews === 1 ? 'page' : 'pages'} ` +
      `during ${sessions} ${sessions === 1 ? 'session' : 'sessions'} across ` +
      `${days} ${days === 1 ? 'day' : 'days'}.`
    ];

    if (summary.originalReferrer) {
      paragraphs.push(`Their original referrer was ${String(summary.originalReferrer).slice(0, 1000)}.`);
    }

    const firstTouch = summary.firstTouch || {};
    if (firstTouch.utm_source || firstTouch.utm_medium || firstTouch.utm_campaign) {
      let campaignSentence = `Their first-touch source was ${firstTouch.utm_source || 'unknown'}`;
      if (firstTouch.utm_medium) campaignSentence += ` through ${firstTouch.utm_medium}`;
      if (firstTouch.utm_campaign) campaignSentence += ` from the ${firstTouch.utm_campaign} campaign`;
      if (firstTouch.utm_content) campaignSentence += ` using ${firstTouch.utm_content} content`;
      if (firstTouch.utm_term) campaignSentence += ` with the term ${firstTouch.utm_term}`;
      paragraphs.push(campaignSentence + '.');
    }

    const pages = Array.isArray(summary.recentPages) ? summary.recentPages.slice(-12) : [];
    if (pages.length) {
      const journey = pages.map((page) => {
        return String(page.title || page.path || '/').slice(0, 120);
      }).join(' → ');
      paragraphs.push(`Their recent journey was: ${journey}.`);
    }

    if (lastVisit) paragraphs.push(`Their most recent recorded visit was ${lastVisit}.`);
    return paragraphs.join('\n\n').slice(0, 12000);
  } catch (e) {
    return '';
  }
}

async function getZohoAccess() {
  const accountsDomain = trimTrailingSlash(
    process.env.ZOHO_ACCOUNTS_DOMAIN || 'https://accounts.zoho.com'
  );
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('Zoho API credentials are not configured');
  }

  const tokenUrl = new URL(`${accountsDomain}/oauth/v2/token`);
  tokenUrl.searchParams.set('refresh_token', refreshToken);
  tokenUrl.searchParams.set('client_id', clientId);
  tokenUrl.searchParams.set('client_secret', clientSecret);
  tokenUrl.searchParams.set('grant_type', 'refresh_token');

  const tokenRes = await zohoFetch(tokenUrl, { method: 'POST' });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.access_token) {
    const reason = tokenData.error || `HTTP_${tokenRes.status}`;
    throw new Error(`Zoho token refresh failed (${reason})`);
  }

  return {
    accessToken: tokenData.access_token,
    apiDomain: trimTrailingSlash(
      process.env.ZOHO_API_DOMAIN || tokenData.api_domain || 'https://www.zohoapis.com'
    )
  };
}

async function upsertZohoLead(record, tagName) {
  const { accessToken, apiDomain } = await getZohoAccess();
  const headers = {
    'Authorization': `Zoho-oauthtoken ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const upsertRes = await zohoFetch(`${apiDomain}/crm/v8/Leads/upsert`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      data: [record],
      duplicate_check_fields: ['Email'],
      trigger: ['workflow']
    })
  });
  const upsertData = await upsertRes.json().catch(() => ({}));
  const result = upsertData?.data?.[0];

  if (!upsertRes.ok || result?.status !== 'success' || !result?.details?.id) {
    const code = result?.code || upsertData?.code || `HTTP_${upsertRes.status}`;
    const message = result?.message ? `: ${result.message}` : '';
    throw new Error(`Zoho lead upsert failed (${code})${message}`);
  }

  let tagAdded = false;
  if (tagName) {
    try {
      const tagRes = await zohoFetch(
        `${apiDomain}/crm/v8/Leads/${result.details.id}/actions/add_tags`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ tags: [{ name: tagName }] })
        }
      );
      const tagData = await tagRes.json().catch(() => ({}));
      tagAdded = tagRes.ok && tagData?.data?.[0]?.status === 'success';
      if (!tagAdded) {
        console.error('Zoho lead tag was not added:', tagData?.data?.[0]?.code || tagRes.status);
      }
    } catch (tagErr) {
      console.error('Zoho lead tag error:', tagErr.message);
    }
  }

  return {
    id: result.details.id,
    action: result.action,
    tagAdded
  };
}

function buildTryLeadRecord(body) {
  const visitSummary = formatVisitSummary(
    body.visit_summary,
    'requesting the Try Simple Genius for Free brief'
  );
  const description = [
    'Try Simple Genius for Free brief requested.',
    body.socials ? `Company socials:\n${String(body.socials).trim()}` : '',
    [
      body.competitor1Name
        ? `Competitor 1: ${String(body.competitor1Name).trim()} (${normalizeUrl(body.competitor1Site)})`
        : '',
      body.competitor2Name
        ? `Competitor 2: ${String(body.competitor2Name).trim()} (${normalizeUrl(body.competitor2Site)})`
        : ''
    ].filter(Boolean).join('\n')
  ].filter(Boolean).join('\n\n');

  const record = {
    First_Name: String(body.firstName || '').trim(),
    Last_Name: String(body.lastName || '').trim(),
    Email: String(body.email || '').trim().toLowerCase(),
    Company: String(body.company || '').trim(),
    Lead_Source1: 'Website Direct',
    Prospect_Source_Detail: 'Try Simple Genius for Free'
  };

  setIfPresent(record, 'Designation', String(body.role || '').trim());
  setIfPresent(record, 'Website', normalizeUrl(body.website));
  setIfPresent(record, 'Description', description);
  setIfPresent(record, 'Multi_Line_6', visitSummary);
  setIfPresent(record, 'UTM_Source', body.utm_source);
  setIfPresent(record, 'UTM_Medium', body.utm_medium);
  setIfPresent(record, 'UTM_Campaign', body.utm_campaign);
  setIfPresent(record, 'UTM_Content', body.utm_content);
  setIfPresent(record, 'UTM_Term', body.utm_term);
  setIfPresent(record, 'GCLID_Track', body.gclid);
  setIfPresent(record, 'Page_URL', body.page_url || body.landing_page);
  setIfPresent(record, 'Referrer', body.referrer);
  setIfPresent(record, 'GA_Client_ID', body.ga_client_id);

  const extraTracking = [];
  if (body.fbclid) extraTracking.push(`fbclid: ${body.fbclid}`);
  if (body.li_fat_id) extraTracking.push(`li_fat_id: ${body.li_fat_id}`);
  if (body.first_visit && !visitSummary) extraTracking.push(`First Visit: ${body.first_visit}`);
  if (extraTracking.length) {
    record.Description = [
      record.Description,
      '--- Additional Attribution ---',
      ...extraTracking
    ].filter(Boolean).join('\n');
  }

  return record;
}

async function syncTryLead(body) {
  const record = buildTryLeadRecord(body);
  return upsertZohoLead(record, 'try-simple-genius-free');
}

function buildBriefDeliveryDescription(existingDescription, { pdfUrl, jobId, deliveredAt } = {}) {
  const current = String(existingDescription || '').trim();
  const cleanPdfUrl = String(pdfUrl || '').trim();
  const cleanJobId = String(jobId || '').trim();
  if (!cleanPdfUrl || !cleanJobId) {
    throw new Error('Brief delivery requires both pdfUrl and jobId');
  }

  const marker = `Competitive AI Scan ID: ${cleanJobId}`;
  if (current.includes(marker) || current.includes(cleanPdfUrl)) {
    return { changed: false, description: current };
  }

  const delivered = deliveredAt ? new Date(deliveredAt) : new Date();
  const deliveredIso = Number.isNaN(delivered.getTime())
    ? String(deliveredAt)
    : delivered.toISOString();
  const section = [
    '--- Competitive AI Scan Delivered ---',
    `Report PDF: ${cleanPdfUrl}`,
    `Delivered At: ${deliveredIso}`,
    marker
  ].join('\n');

  return {
    changed: true,
    description: current ? `${current}\n\n${section}` : section
  };
}

// Finds an existing Zoho lead by email so a later touch (Let's Talk form,
// a booked call) can be merged into the same record instead of blindly
// overwriting fields a prior touch already set (e.g. how they first entered).
async function findLeadByEmail(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  const { accessToken, apiDomain } = await getZohoAccess();
  const criteria = `(Email:equals:${encodeURIComponent(cleanEmail)})`;
  const searchRes = await zohoFetch(`${apiDomain}/crm/v8/Leads/search?criteria=${criteria}`, {
    headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
  });

  if (searchRes.status === 204) return null; // Zoho: no matching records
  const searchData = await searchRes.json().catch(() => ({}));
  if (!searchRes.ok) {
    throw new Error(`Zoho lead search failed (HTTP_${searchRes.status})`);
  }
  const match = Array.isArray(searchData?.data) ? searchData.data[0] : null;
  return match || null;
}

// Records the exact PDF delivered for a Competitive AI Scan on the matching
// Zoho Lead. The Lead is matched by email; this function never creates a new
// record. The structured Description section is idempotent by job ID and URL.
// If the Lead changes between read and write, Zoho rejects the conditional
// update instead of allowing this delivery write to overwrite newer CRM data.
async function recordBriefDeliveryOnLead({ email, pdfUrl, jobId, deliveredAt } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const existing = await findLeadByEmail(email);
      if (!existing) {
        lastError = new Error('No matching Zoho Lead found');
        if (attempt < 2) continue;
        return { found: false, action: 'noop' };
      }

      const built = buildBriefDeliveryDescription(existing.Description, {
        pdfUrl,
        jobId,
        deliveredAt
      });
      if (!built.changed) {
        return { found: true, id: existing.id, action: 'noop' };
      }

      const { accessToken, apiDomain } = await getZohoAccess();
      const headers = {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      };
      if (existing.Modified_Time) {
        headers['If-Unmodified-Since'] = existing.Modified_Time;
      }

      const updateRes = await zohoFetch(`${apiDomain}/crm/v8/Leads/${existing.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          data: [{ Description: built.description }],
          trigger: []
        })
      });
      const updateData = await updateRes.json().catch(() => ({}));
      const result = updateData?.data?.[0];

      if (updateRes.ok && result?.status === 'success') {
        return { found: true, id: existing.id, action: 'update' };
      }

      const code = result?.code || updateData?.code || `HTTP_${updateRes.status}`;
      const message = result?.message ? `: ${result.message}` : '';
      lastError = new Error(`Zoho brief delivery update failed (${code})${message}`);
      const retryable = updateRes.status === 412 || updateRes.status === 429 || updateRes.status >= 500;
      if (!retryable || attempt === 2) throw lastError;
    } catch (err) {
      lastError = err;
      const retryableNetworkError =
        err?.name === 'TimeoutError' ||
        err?.name === 'AbortError' ||
        err instanceof TypeError;
      if (!retryableNetworkError || attempt === 2) throw err;
    }
  }

  throw lastError || new Error('Zoho brief delivery update failed');
}

// Merges a new touchpoint into an existing lead (found by email) without
// clobbering what a prior touch already recorded:
//  - descriptionAppend is added as a new dated paragraph, never replaces
//    the existing Description text.
//  - prospectSourceAppend is combined onto the existing Prospect_Source_Detail
//    (e.g. "Try Simple Genius for Free + Let's Talk") instead of overwriting it,
//    and is skipped if already present.
//  - extraFields are set only when present (same setIfPresent contract as
//    the rest of this module).
// Returns { found: false } if no lead exists yet for this email so the
// caller can fall back to a normal insert.
async function appendLeadTouch(email, { prospectSourceAppend, descriptionAppend, extraFields } = {}) {
  const existing = await findLeadByEmail(email);
  if (!existing) return { found: false };

  const { accessToken, apiDomain } = await getZohoAccess();
  const headers = {
    'Authorization': `Zoho-oauthtoken ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const updateRecord = {};

  if (descriptionAppend) {
    const existingDescription = String(existing.Description || '').trim();
    updateRecord.Description = existingDescription
      ? `${existingDescription}\n\n${descriptionAppend}`
      : descriptionAppend;
  }

  if (prospectSourceAppend) {
    const existingSource = String(existing.Prospect_Source_Detail || '').trim();
    if (!existingSource) {
      updateRecord.Prospect_Source_Detail = prospectSourceAppend;
    } else if (!existingSource.toLowerCase().includes(prospectSourceAppend.toLowerCase())) {
      updateRecord.Prospect_Source_Detail = `${existingSource} + ${prospectSourceAppend}`;
    }
  }

  if (extraFields) {
    Object.keys(extraFields).forEach((key) => setIfPresent(updateRecord, key, extraFields[key]));
  }

  if (Object.keys(updateRecord).length === 0) {
    return { found: true, id: existing.id, action: 'noop' };
  }

  const updateRes = await zohoFetch(`${apiDomain}/crm/v8/Leads/${existing.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ data: [updateRecord], trigger: ['workflow'] })
  });
  const updateData = await updateRes.json().catch(() => ({}));
  const result = updateData?.data?.[0];

  if (!updateRes.ok || result?.status !== 'success') {
    const code = result?.code || updateData?.code || `HTTP_${updateRes.status}`;
    const message = result?.message ? `: ${result.message}` : '';
    const details = result?.details ? ` details=${JSON.stringify(result.details)}` : '';
    const sentFields = ` sentFields=${JSON.stringify(updateRecord)}`;
    throw new Error(`Zoho lead update failed (${code})${message}${details}${sentFields}`);
  }

  return { found: true, id: existing.id, action: 'update' };
}

module.exports = {
  buildTryLeadRecord,
  formatVisitDate,
  formatVisitSummary,
  normalizeUrl,
  syncTryLead,
  upsertZohoLead,
  findLeadByEmail,
  buildBriefDeliveryDescription,
  recordBriefDeliveryOnLead,
  appendLeadTouch
};
