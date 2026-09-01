// Vercel serverless function — POST /api/schedule-confirmed
// Fires when a Calendly booking on talk-schedule.html actually completes
// (calendly.event_scheduled). Adds the contact to the ActiveCampaign
// "Let's Talk - Perplexity Automation" so the confirmed-time follow-up email
// sends only once a real time slot is booked — not on the earlier lead form.
// Env vars used: AC_URL, AC_KEY

const AUTOMATION_ID = '30';
const AUTOMATION_NAME = "Let's Talk - Perplexity Automation";

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function findAutomationIdByName(AC_URL, AC_KEY, name) {
  const target = normalize(name);
  let offset = 0;
  const limit = 100;

  for (let page = 0; page < 5; page++) {
    const res = await fetch(`${AC_URL}/api/3/automations?limit=${limit}&offset=${offset}`, {
      headers: { 'Api-Token': AC_KEY }
    });
    const data = await res.json();
    const automations = data?.automations || [];
    const match = automations.find((a) => normalize(a.name) === target);
    if (match) return match.id;
    if (automations.length < limit) break;
    offset += limit;
  }
  return null;
}

async function addContactToAutomation(AC_URL, AC_KEY, contactId, automationId) {
  const res = await fetch(`${AC_URL}/api/3/contactAutomations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Api-Token': AC_KEY },
    body: JSON.stringify({ contactAutomation: { contact: contactId, automation: automationId } })
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* leave null */ }
  return { ok: res.ok && !!data?.contactAutomation, data };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const email = String(body.email || '').trim();
    const fullName = String(body.name || '').trim();
    const nameParts = fullName.split(' ').filter(Boolean);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    if (!email) return res.status(400).json({ ok: false, error: 'Email required' });

    const AC_URL = process.env.AC_URL || 'https://simplegenius.api-us1.com';
    const AC_KEY = process.env.AC_KEY;

    // 1. Ensure the contact exists / is up to date. One retry on transient failure.
    let contactId = null;
    for (let attempt = 0; attempt < 2 && !contactId; attempt++) {
      const contactRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Api-Token': AC_KEY },
        body: JSON.stringify({ contact: { email, firstName, lastName } })
      });
      const contactData = await contactRes.json();
      contactId = contactData?.contact?.id || null;
    }

    if (!contactId) {
      return res.status(500).json({ ok: false, error: 'Contact sync failed after retry' });
    }

    // 1b. Subscribe to Master Contact List (list 3) — required for AC to
    //     actually deliver automation emails. Without a list subscription,
    //     AC silently skips the send even though the automation step runs.
    try {
      await fetch(`${AC_URL}/api/3/contactLists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Api-Token': AC_KEY },
        body: JSON.stringify({ contactList: { list: 3, contact: contactId, status: 1 } })
      });
    } catch (listErr) {
      console.error('schedule-confirmed list subscribe error:', listErr.message);
    }

    // 2. Enter the contact into the automation. Try the known automation ID
    //    first (fast path); fall back to a name lookup if that ever fails
    //    (e.g. the automation gets rebuilt with a new ID), with one retry.
    let automationId = AUTOMATION_ID;
    let addResult = await addContactToAutomation(AC_URL, AC_KEY, contactId, automationId);

    if (!addResult.ok) {
      const foundId = await findAutomationIdByName(AC_URL, AC_KEY, AUTOMATION_NAME);
      if (foundId) {
        automationId = foundId;
        addResult = await addContactToAutomation(AC_URL, AC_KEY, contactId, automationId);
      }
    }

    if (!addResult.ok) {
      // Last retry attempt before giving up.
      addResult = await addContactToAutomation(AC_URL, AC_KEY, contactId, automationId);
    }

    if (!addResult.ok) {
      return res.status(500).json({ ok: false, error: 'Could not add contact to automation', detail: addResult.data });
    }

    return res.status(200).json({ ok: true, contactId, automationId, result: addResult.data });
  } catch (err) {
    console.error('schedule-confirmed error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
