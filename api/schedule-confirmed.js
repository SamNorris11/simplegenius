// Vercel serverless function — POST /api/schedule-confirmed
// Fires when a Calendly booking on talk-schedule.html actually completes
// (calendly.event_scheduled). Adds the contact to the ActiveCampaign
// "Let's talk follow-up" automation so the confirmed-time follow-up email
// sends only once a real time slot is booked — not on the earlier lead form.
// Env vars used: AC_URL, AC_KEY

const AUTOMATION_NAME = "Let's talk follow-up";

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

    // 1. Ensure the contact exists / is up to date.
    const contactRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Token': AC_KEY },
      body: JSON.stringify({ contact: { email, firstName, lastName } })
    });
    const contactData = await contactRes.json();
    const contactId = contactData?.contact?.id;

    if (!contactId) {
      return res.status(500).json({ ok: false, error: 'Contact sync failed', detail: contactData });
    }

    // 2. Find the automation by name (self-heals if it's ever recreated).
    const automationId = await findAutomationIdByName(AC_URL, AC_KEY, AUTOMATION_NAME);
    if (!automationId) {
      return res.status(500).json({ ok: false, error: `Automation "${AUTOMATION_NAME}" not found` });
    }

    // 3. Enter the contact into the automation.
    const addRes = await fetch(`${AC_URL}/api/3/contactAutomations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Token': AC_KEY },
      body: JSON.stringify({ contactAutomation: { contact: contactId, automation: automationId } })
    });
    const addData = await addRes.json();

    return res.status(200).json({ ok: true, contactId, automationId, result: addData });
  } catch (err) {
    console.error('schedule-confirmed error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
