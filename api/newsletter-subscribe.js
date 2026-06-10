// Vercel serverless function — POST /api/newsletter-subscribe
// Posts to ActiveCampaign sync/list/tag (tag 22 = newsletter-subscriber)

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const { email = '', full_name = '', fullName = '' } = body;
    const name = (full_name || fullName || '').trim();
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    if (!email) return res.status(400).json({ ok: false, error: 'Email required' });

    const AC_URL = process.env.AC_URL || 'https://simplegenius.api-us1.com';
    const AC_KEY = process.env.AC_KEY;

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

    await fetch(`${AC_URL}/api/3/contactLists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Token': AC_KEY },
      body: JSON.stringify({ contactList: { list: 3, contact: contactId, status: 1 } })
    });
    await fetch(`${AC_URL}/api/3/contactTags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Token': AC_KEY },
      body: JSON.stringify({ contactTag: { contact: contactId, tag: 22 } })
    });

    return res.status(200).json({ ok: true, contactId });
  } catch (err) {
    console.error('newsletter-subscribe error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
