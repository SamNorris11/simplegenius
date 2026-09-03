// TEMPORARY diagnostic route — read-only, no writes. Remove after use.
module.exports = async (req, res) => {
  try {
    const AC_URL = process.env.AC_URL || 'https://simplegenius.api-us1.com';
    const AC_KEY = process.env.AC_KEY;
    const contactId = String(req.query.contactId || '').trim();
    if (!contactId) return res.status(400).json({ ok: false, error: 'contactId required' });

    const r = await fetch(`${AC_URL}/api/3/contacts/${contactId}/contactAutomations?limit=2500`, {
      headers: { 'Api-Token': AC_KEY }
    });
    const data = await r.json();
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
