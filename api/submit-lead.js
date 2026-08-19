// Vercel serverless function — POST /api/submit-lead
// Posts to Zoho Web-to-Lead + ActiveCampaign sync/list/tag
// Env vars used: AC_URL, AC_KEY
//
// Sources supported (via body.source):
//   'waitlist' -> Lead Source = Website Direct, tag waitlist-2026, Prospect
//                 Source Detail = Join the Waitlist, Website (std field) set
//   default    -> Lead Source = Direct Inbound, tag lets-talk-inbound (76)

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
      first_visit = ''
    } = body;

    const isWaitlist = String(source).toLowerCase() === 'waitlist';
    // Lead Source per Jarvis: reuse 'Website Direct' picklist value for waitlist,
    // keep 'Direct Inbound' for the existing homepage/Let's Talk pathway.
    const leadSource = isWaitlist ? 'Website Direct' : 'Direct Inbound';

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

    // Waitlist header — surfaces tag intent + Prospect Source Detail in the
    // Zoho lead Description so George's workflow can pick it up. Zoho
    // Web-to-Lead doesn't accept tags/custom-picklist writes directly, so we
    // encode the intent in the Description body until the WTL form is
    // extended with a Prospect Source Detail LEADCF slot.
    const waitlistHeader = isWaitlist
      ? 'Prospect Source Detail: Join the Waitlist\nZoho Tags: waitlist-2026\n\n'
      : '';

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

    // ── 1. Zoho Web-to-Lead ─────────────────────────────────────────────────
    let zohoStatus = null;
    try {
      const zohoParams = new URLSearchParams();
      zohoParams.append('xnQsjsdp', '16a94b737bb4cc0b770f6b31ecd60a901ca27fa0ca903ed1dce668e83ed84ee6');
      zohoParams.append('xmIwtLD', 'a147a2785f061e935824b204ab91754a91d7155889aaeda1b3e1468a4bec869008f04fe153b617310f07c579b6958e77');
      zohoParams.append('actionType', 'TGVhZHM=');
      zohoParams.append('returnURL', 'https://www.simplegenius.com');
      zohoParams.append('First Name', firstName);
      zohoParams.append('Last Name', lastName);
      zohoParams.append('Email', email);
      zohoParams.append('Company', company);
      zohoParams.append('Designation', titleVal);
      if (website) zohoParams.append('Website', website);
      zohoParams.append('Lead Source', leadSource);
      zohoParams.append('Industry', industryVal);
      zohoParams.append('LEADCF2', companySizeVal || '-None-');
      zohoParams.append('LEADCF4', utm_medium || '');
      zohoParams.append('LEADCF5', utm_content || '');
      zohoParams.append('LEADCF6', utm_term || '');
      zohoParams.append('LEADCF8', utm_campaign || '');
      zohoParams.append('LEADCF14', gclid || '');
      zohoParams.append('LEADCF15', utm_source || '');
      zohoParams.append('Description', waitlistHeader + (solveVal || '') + (howHeardVal ? '\nHow they heard: ' + howHeardVal : '') + attrBlock);
      zohoParams.append('zc_gad', '');
      zohoParams.append('aG9uZXlwb3Q', '');

      const zohoRes = await fetch('https://crm.zoho.com/crm/WebToLeadForm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: zohoParams.toString(),
        redirect: 'manual'
      });
      zohoStatus = zohoRes.status;
    } catch (zohoErr) {
      console.error('Zoho error:', zohoErr.message);
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

    return res.status(200).json({ ok: true, zohoStatus, contactId, waitlistTagId, source: isWaitlist ? 'waitlist' : 'default' });
  } catch (err) {
    console.error('submit-lead error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
