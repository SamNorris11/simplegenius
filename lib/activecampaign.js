// Direct ActiveCampaign REST API v3 wiring.
// Deliberately NOT using the Pipedream connector tool set — those tools only
// run inside the agent sandbox, not inside this Vercel serverless function.
// This module talks to ActiveCampaign directly using AC_URL + AC_KEY (already
// provisioned in Vercel Production env), so it works the same way in prod.
//
// Design goal: never let ActiveCampaign issues block PDF delivery. Every
// exported function is best-effort — callers should wrap calls in try/catch
// (or use `syncBriefDelivered`, which already does this) and treat AC sync as
// a nice-to-have side effect, not a requirement for marking a job DELIVERED.

const CUSTOM_FIELD_TITLE = 'Brief Status';
const READY_TAG_NAME = 'Brief Ready';

function getConfig() {
  const baseUrl = process.env.AC_URL;
  const apiKey = process.env.AC_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}

async function acRequest(method, path, body) {
  const config = getConfig();
  if (!config) throw new Error('ActiveCampaign not configured (AC_URL / AC_KEY missing).');
  const res = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      'Api-Token': config.apiKey,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(`AC ${method} ${path} returned non-JSON (status ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`AC ${method} ${path} failed (status ${res.status}): ${JSON.stringify(json).slice(0, 500)}`);
  }
  return json;
}

/** Find an existing tag by exact name, or create it. Returns the tag id (string). */
async function ensureTag(tagName) {
  const list = await acRequest('GET', `/api/3/tags?search=${encodeURIComponent(tagName)}&limit=100`);
  const existing = (list.tags || []).find((t) => t.tag === tagName);
  if (existing) return existing.id;

  const created = await acRequest('POST', '/api/3/tags', {
    tag: { tag: tagName, tagType: 'contact', description: 'Auto-created by Simple Genius brief pipeline.' },
  });
  return created.tag.id;
}

/** Find an existing contact custom field by exact title, or create it (type: text). Returns the field id (string). */
async function ensureCustomField(title) {
  const list = await acRequest('GET', `/api/3/fields?limit=100`);
  const existing = (list.fields || []).find((f) => f.title === title);
  if (existing) return existing.id;

  const created = await acRequest('POST', '/api/3/fields', {
    field: {
      type: 'text',
      title,
      descript: 'Auto-created by Simple Genius brief pipeline.',
      visible: 1,
    },
  });
  return created.field.id;
}

/** Create or update a contact by email. Returns the contact id (string). */
async function upsertContact({ email, firstName, lastName }) {
  const result = await acRequest('POST', '/api/3/contact/sync', {
    contact: {
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    },
  });
  return result.contact.id;
}

async function setFieldValue(contactId, fieldId, value) {
  return acRequest('POST', '/api/3/fieldValues', {
    fieldValue: { contact: contactId, field: fieldId, value },
  });
}

async function tagContact(contactId, tagId) {
  // AC returns 422 if the contact already has this tag — treat as success.
  try {
    return await acRequest('POST', '/api/3/contactTags', {
      contactTag: { contact: contactId, tag: tagId },
    });
  } catch (err) {
    if (/already/i.test(String(err.message))) return null;
    throw err;
  }
}

/**
 * Best-effort sync for a delivered brief: upsert the contact, ensure the
 * "Brief Status" custom field and "Brief Ready" tag exist (creating them on
 * first use since Sam hasn't set them up in the AC dashboard yet), set the
 * field to "Ready", and apply the tag.
 *
 * Never throws on AC-side failures that shouldn't block delivery — logs and
 * returns { ok: false, error } instead so the caller can record it without
 * failing the whole job.
 */
async function syncBriefDelivered({ email, firstName, lastName }) {
  if (!getConfig()) {
    return { ok: false, skipped: true, error: 'AC_URL/AC_KEY not configured' };
  }
  try {
    const contactId = await upsertContact({ email, firstName, lastName });
    const [fieldId, tagId] = await Promise.all([
      ensureCustomField(CUSTOM_FIELD_TITLE),
      ensureTag(READY_TAG_NAME),
    ]);
    await setFieldValue(contactId, fieldId, 'Ready');
    await tagContact(contactId, tagId);
    return { ok: true, contactId, fieldId, tagId };
  } catch (err) {
    console.error('ActiveCampaign sync failed (non-blocking):', err);
    return { ok: false, error: String(err.message || err).slice(0, 500) };
  }
}

module.exports = { syncBriefDelivered, ensureTag, ensureCustomField, upsertContact, setFieldValue, tagContact };
