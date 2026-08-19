// Vercel serverless function — POST /api/submit-lead
// Upserts into Zoho CRM through the REST API + ActiveCampaign sync/list/tag
// Env vars used: ZOHO_REFRESH_TOKEN, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET,
// ZOHO_ACCOUNTS_DOMAIN, ZOHO_API_DOMAIN, AC_URL, AC_KEY
//
// Sources supported (via body.source):
//   'waitlist' -> Lead Source = Website Direct, tag waitlist-2026, Prospect
//                 Source Detail = Join the Waitlist, Website (std field) set
//   default    -> Lead Source = Website Direct, tag lets-talk-inbound (76)

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const normalizeUrl = (value) => {
  const clean = String(value || '').trim();
  if (!clean) return '';
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
};

const setIfPresent = (record, key, value) => {
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    record[key] = value;
  }
};

const formatVisitSummary = (value) => {
  if (!value) return '';
  try {
    const summary = typeof value === 'string' ? JSON.parse(value) : value;
    const lines = [];
    const add = (label, field) => {
      if (field !== undefined && field !== null && String(field).trim() !== '') {
        lines.push(`${label}: ${String(field).slice(0, 1000)}`);
      }
    };

    add('First visit', summary.firstVisit);
    add('Last visit', summary.lastVisit);
    add('Sessions', summary.sessionCount);
    add('Page views', summary.pageViews);
    add('Days visited', summary.daysVisited);
    add('First page', summary.landingPage);
    add('Original referrer', summary.originalReferrer);

    const firstTouch = summary.firstTouch || {};
    const firstTouchParts = [
      firstTouch.utm_source && `source=${firstTouch.utm_source}`,
      firstTouch.utm_medium && `medium=${firstTouch.utm_medium}`,
      firstTouch.utm_campaign && `campaign=${firstTouch.utm_campaign}`,
      firstTouch.utm_content && `content=${firstTouch.utm_content}`,
      firstTouch.utm_term && `term=${firstTouch.utm_term}`
    ].filter(Boolean);
    if (firstTouchParts.length) add('First-touch campaign', firstTouchParts.join(' | '));

    const pages = Array.isArray(summary.recentPages) ? summary.recentPages.slice(-12) : [];
    if (pages.length) {
      lines.push('Recent journey:');
      pages.forEach((page) => {
        const when = String(page.visitedAt || '').slice(0, 19).replace('T', ' ');
        const path = String(page.path || '/').slice(0, 500);
        const title = String(page.title || '').slice(0, 120);
        lines.push(`- ${when} | ${path}${title ? ` | ${title}` : ''}`);
      });
    }

    return lines.join('\n').slice(0, 12000);
  } catch (e) {
    return '';
  }
};

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

  const tokenRes = await fetch(tokenUrl, { method: 'POST' });
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

async function upsertZohoLead(record, isWaitlist) {
  const { accessToken, apiDomain } = await getZohoAccess();
  const headers = {
    'Authorization': `Zoho-oauthtoken ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const upsertRes = await fetch(`${apiDomain}/crm/v8/Leads/upsert`, {
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
    throw new Error(`Zoho lead upsert failed (${code})`);
  }

  let tagAdded = false;
  if (isWaitlist) {
    try {
      const tagRes = await fetch(
        `${apiDomain}/crm/v8/Leads/${result.details.id}/actions/add_tags`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ tags: [{ name: 'waitlist-2026' }] })
        }
      );
      const tagData = await tagRes.json().catch(() => ({}));
      tagAdded = tagRes.ok && tagData?.data?.[0]?.status === 'success';
      if (!tagAdded) {
        console.error('Zoho waitlist tag was not added:', tagData?.data?.[0]?.code || tagRes.status);
      }
    } catch (tagErr) {
      console.error('Zoho waitlist tag error:', tagErr.message);
    }
  }

  return {
    id: result.details.id,
    action: result.action,
    tagAdded
  };
}

async function submitZohoWebToLead({
  firstName,
  lastName,
  email,
  company,
  title,
  website,
  leadSource,
  industry,
  companySize,
  description,
  utmSource,
  utmMedium,
  utmCampaign,
  utmContent,
  utmTerm,
  gclid
}) {
  const zohoParams = new URLSearchParams();
  zohoParams.append('xnQsjsdp', '16a94b737bb4cc0b770f6b31ecd60a901ca27fa0ca903ed1dce668e83ed84ee6');
  zohoParams.append('xmIwtLD', 'a147a2785f061e935824b204ab91754a91d7155889aaeda1b3e1468a4bec869008f04fe153b617310f07c579b6958e77');
  zohoParams.append('actionType', 'TGVhZHM=');
  zohoParams.append('returnURL', 'https://www.simplegenius.com');
  zohoParams.append('First Name', firstName);
  zohoParams.append('Last Name', lastName);
  zohoParams.append('Email', email);
  zohoParams.append('Company', company);
  zohoParams.append('Designation', title);
  if (website) zohoParams.append('Website', normalizeUrl(website));
  zohoParams.append('Lead Source', leadSource);
  zohoParams.append('Industry', industry);
  zohoParams.append('LEADCF2', companySize || '-None-');
  zohoParams.append('LEADCF4', utmMedium || '');
  zohoParams.append('LEADCF5', utmContent || '');
  zohoParams.append('LEADCF6', utmTerm || '');
  zohoParams.append('LEADCF8', utmCampaign || '');
  zohoParams.append('LEADCF14', gclid || '');
  zohoParams.append('LEADCF15', utmSource || '');
  zohoParams.append('Description', description || '');
  zohoParams.append('zc_gad', '');
  zohoParams.append('aG9uZXlwb3Q', '');

  const zohoRes = await fetch('https://crm.zoho.com/crm/WebToLeadForm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: zohoParams.toString(),
    redirect: 'manual'
  });
  if (zohoRes.status < 200 || zohoRes.status >= 400) {
    throw new Error(`Zoho Web-to-Lead fallback failed (HTTP_${zohoRes.status})`);
  }

  return {
    id: null,
    action: 'web-to-lead-fallback',
    tagAdded: false
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    // Body parsing — Vercel parses JSON automatically for application/json
    const body = req.body || {};
    // Accept both snake_case (legacy) and the field names actually emitted
    // by the homepage form (fullName, role, companySize, hearAboutUs, challenge).
    const {
      full_name = '',
      fullName = '',
      email = '',
      company = '',
      website = '',
      title = '',
      role = '',
      company_size = '',
      companySize = '',
      industry = '',
      how_heard = '',
      hearAboutUs = '',
      solve = '',
      challenge = '',
      source = '',
      // Attribution / tracking (hidden form fields)
      utm_source = '',
      utm_medium = '',
      utm_campaign = '',
      utm_term = '',
      utm_content = '',
      gclid = '',
      fbclid = '',
      li_fat_id = '',
      page_url = '',
      referrer = '',
      ga_client_id = '',
      landing_page = '',
      first_visit = '',
      visit_summary = ''
    } = body;

    const isWaitlist = String(source).toLowerCase() === 'waitlist';
    // The current CRM source dictionary uses Website Direct for website forms.
    const leadSource = 'Website Direct';

    // Build a compact attribution block to append to descriptions
    const attrLines = [];
    if (utm_source)   attrLines.push('UTM Source: ' + utm_source);
    if (utm_medium)   attrLines.push('UTM Medium: ' + utm_medium);
    if (utm_campaign) attrLines.push('UTM Campaign: ' + utm_campaign);
    if (utm_term)     attrLines.push('UTM Term: ' + utm_term);
    if (utm_content)  attrLines.push('UTM Content: ' + utm_content);
    if (gclid)        attrLines.push('gclid: ' + gclid);
    if (fbclid)       attrLines.push('fbclid: ' + fbclid);
    if (li_fat_id)    attrLines.push('li_fat_id: ' + li_fat_id);
    if (page_url)     attrLines.push('Page URL: ' + page_url);
    if (referrer)     attrLines.push('Referrer: ' + referrer);
    if (landing_page) attrLines.push('Landing Page: ' + landing_page);
    if (first_visit)  attrLines.push('First Visit: ' + first_visit);
    if (ga_client_id) attrLines.push('GA Client ID: ' + ga_client_id);
    const attrBlock = attrLines.length ? ('\n\n--- Attribution ---\n' + attrLines.join('\n')) : '';

    const waitlistHeader = isWaitlist ? 'Join the Waitlist\n\n' : '';
    const websiteVisitSummary = formatVisitSummary(visit_summary);

    // Coalesce the variants
    const titleVal       = title       || role          || '';
    const companySizeVal = company_size || companySize  || '';
    const howHeardVal    = how_heard   || hearAboutUs   || '';
    const solveVal       = solve       || challenge     || '';

    // Map form slugs to Zoho picklist display values
    const industryMap = {
      'financial-services': 'Financial Services',
      'insurance':          'Insurance',
      'accounting-tax':     'Accounting / Tax',
      'compliance-audit':   'Compliance / Audit',
      'technology':         'Other',
      'healthcare':         'Other',
      'real-estate':        'Other',
      'other':              'Other'
    };
    const industryVal = industryMap[industry] || '-None-';

    const name = (full_name || fullName || '').trim();
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || firstName;

    // ── 1. Zoho CRM ─────────────────────────────────────────────────────────
    let zoho = null;
    let zohoError = null;
    try {
      const zohoLead = {
        First_Name: firstName,
        Last_Name: lastName,
        Email: email,
        Company: company,
        Lead_Source1: leadSource
      };

      setIfPresent(zohoLead, 'Designation', titleVal);
      setIfPresent(zohoLead, 'Website', normalizeUrl(website));
      setIfPresent(
        zohoLead,
        'Description',
        [
          solveVal || '',
          howHeardVal ? `How they heard: ${howHeardVal}` : '',
          websiteVisitSummary ? `--- Website Visit Summary ---\n${websiteVisitSummary}` : ''
        ].filter(Boolean).join('\n\n')
      );
      if (isWaitlist) {
        zohoLead.Prospect_Source_Detail = 'Join the Waitlist';
      }
      setIfPresent(zohoLead, 'UTM_Source', utm_source);
      setIfPresent(zohoLead, 'UTM_Medium', utm_medium);
      setIfPresent(zohoLead, 'UTM_Campaign', utm_campaign);
      setIfPresent(zohoLead, 'UTM_Content', utm_content);
      setIfPresent(zohoLead, 'UTM_Term', utm_term);
      setIfPresent(zohoLead, 'GCLID_Track', gclid);
      setIfPresent(zohoLead, 'Page_URL', page_url || landing_page);
      setIfPresent(zohoLead, 'Referrer', referrer);
      setIfPresent(zohoLead, 'GA_Client_ID', ga_client_id);

      // Keep click IDs that do not have governed CRM fields in Description.
      const extraTracking = [];
      if (fbclid) extraTracking.push(`fbclid: ${fbclid}`);
      if (li_fat_id) extraTracking.push(`li_fat_id: ${li_fat_id}`);
      if (first_visit) extraTracking.push(`First Visit: ${first_visit}`);
      if (extraTracking.length) {
        zohoLead.Description = [
          zohoLead.Description,
          '--- Additional Attribution ---',
          ...extraTracking
        ].filter(Boolean).join('\n');
      }

      zoho = await upsertZohoLead(zohoLead, isWaitlist);
    } catch (zohoErr) {
      zohoError = zohoErr.message;
      console.error('Zoho error:', zohoErr.message);
      if (zohoErr.message.includes('Zoho token refresh failed')) {
        try {
          zoho = await submitZohoWebToLead({
            firstName,
            lastName,
            email,
            company,
            title: titleVal,
            website,
            leadSource,
            industry: industryVal,
            companySize: companySizeVal,
            description: waitlistHeader + (solveVal || '') +
              (websiteVisitSummary ? `\n\n--- Website Visit Summary ---\n${websiteVisitSummary}` : '') +
              attrBlock,
            utmSource: utm_source,
            utmMedium: utm_medium,
            utmCampaign: utm_campaign,
            utmContent: utm_content,
            utmTerm: utm_term,
            gclid
          });
        } catch (fallbackErr) {
          zohoError = `${zohoError}; ${fallbackErr.message}`;
          console.error('Zoho fallback error:', fallbackErr.message);
        }
      }
    }

    // ── 2. ActiveCampaign ───────────────────────────────────────────────────
    const AC_URL = process.env.AC_URL || 'https://simplegenius.api-us1.com';
    const AC_KEY = process.env.AC_KEY;

    let contactId = null;
    let waitlistTagId = null;
    try {
      const contactPayload = {
        contact: {
          email, firstName, lastName,
          fieldValues: [
            { field: '27', value: company },
            { field: '28', value: titleVal },
            { field: '29', value: companySizeVal },
            { field: '30', value: howHeardVal },
            { field: '31', value: waitlistHeader + (solveVal || '') + attrBlock },
            { field: '9',  value: industry },
            { field: '3',  value: leadSource },
          ]
        }
      };

      const contactRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Api-Token': AC_KEY },
        body: JSON.stringify(contactPayload)
      });
      const contactData = await contactRes.json();
      contactId = contactData?.contact?.id;

      if (contactId) {
        // Subscribe to Master Contact List (list 3) — same list for everyone.
        await fetch(`${AC_URL}/api/3/contactLists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Api-Token': AC_KEY },
          body: JSON.stringify({ contactList: { list: 3, contact: contactId, status: 1 } })
        });

        if (isWaitlist) {
          // Look up waitlist-2026 tag id at request time so we don't hardcode
          // a numeric id and so this self-heals if the tag is (re)created.
          try {
            const tagsRes = await fetch(`${AC_URL}/api/3/tags?search=waitlist-2026`, {
              headers: { 'Api-Token': AC_KEY }
            });
            const tagsData = await tagsRes.json();
            const match = (tagsData?.tags || []).find(t => (t.tag || '').toLowerCase() === 'waitlist-2026');
            waitlistTagId = match ? match.id : null;
          } catch (tagErr) {
            console.error('AC tag lookup error:', tagErr.message);
          }
          if (waitlistTagId) {
            await fetch(`${AC_URL}/api/3/contactTags`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Api-Token': AC_KEY },
              body: JSON.stringify({ contactTag: { contact: contactId, tag: waitlistTagId } })
            });
          }
        } else {
          // Existing behavior for homepage / Let's Talk: lets-talk-inbound (tag 76)
          await fetch(`${AC_URL}/api/3/contactTags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Api-Token': AC_KEY },
            body: JSON.stringify({ contactTag: { contact: contactId, tag: 76 } })
          });
        }
      }
    } catch (acErr) {
      console.error('AC error:', acErr.message);
    }

    if (!zoho) {
      return res.status(502).json({
        ok: false,
        error: 'Your information could not be saved. Please try again.',
        zohoError,
        contactId,
        source: isWaitlist ? 'waitlist' : 'default'
      });
    }

    return res.status(200).json({
      ok: true,
      zoho,
      contactId,
      waitlistTagId,
      source: isWaitlist ? 'waitlist' : 'default'
    });
  } catch (err) {
    console.error('submit-lead error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
