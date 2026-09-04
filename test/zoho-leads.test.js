const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildBriefDeliveryDescription,
  recordBriefDeliveryOnLead
} = require('../lib/zoho-leads');

test('appends a labeled Competitive AI Scan section without replacing CRM text', () => {
  const result = buildBriefDeliveryDescription('Existing sales context.', {
    pdfUrl: 'https://blob.example/briefs/scan.pdf',
    jobId: '123e4567-e89b-12d3-a456-426614174000',
    deliveredAt: '2026-09-04T15:30:00.000Z'
  });

  assert.equal(result.changed, true);
  assert.match(result.description, /^Existing sales context\.\n\n/);
  assert.match(result.description, /--- Competitive AI Scan Delivered ---/);
  assert.match(result.description, /Report PDF: https:\/\/blob\.example\/briefs\/scan\.pdf/);
  assert.match(result.description, /Delivered At: 2026-09-04T15:30:00\.000Z/);
  assert.match(result.description, /Competitive AI Scan ID: 123e4567-e89b-12d3-a456-426614174000/);
});

test('is idempotent for an already recorded scan', () => {
  const first = buildBriefDeliveryDescription('', {
    pdfUrl: 'https://blob.example/briefs/scan.pdf',
    jobId: '123e4567-e89b-12d3-a456-426614174000',
    deliveredAt: '2026-09-04T15:30:00.000Z'
  });
  const second = buildBriefDeliveryDescription(first.description, {
    pdfUrl: 'https://blob.example/briefs/scan.pdf',
    jobId: '123e4567-e89b-12d3-a456-426614174000',
    deliveredAt: '2026-09-04T15:31:00.000Z'
  });

  assert.equal(second.changed, false);
  assert.equal(second.description, first.description);
});

test('requires both the PDF URL and scan ID', () => {
  assert.throws(
    () => buildBriefDeliveryDescription('', { pdfUrl: 'https://blob.example/scan.pdf' }),
    /requires both pdfUrl and jobId/
  );
});

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

test('writes the report link with an optimistic concurrency header', async (t) => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  t.after(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });
  Object.assign(process.env, {
    ZOHO_REFRESH_TOKEN: 'refresh',
    ZOHO_CLIENT_ID: 'client',
    ZOHO_CLIENT_SECRET: 'secret',
    ZOHO_FETCH_TIMEOUT_MS: '100'
  });

  const calls = [];
  const responses = [
    jsonResponse(200, { access_token: 'token', api_domain: 'https://www.zohoapis.com' }),
    jsonResponse(200, { data: [{ id: 'lead-1', Description: 'Existing', Modified_Time: '2026-09-04T15:00:00Z' }] }),
    jsonResponse(200, { access_token: 'token', api_domain: 'https://www.zohoapis.com' }),
    jsonResponse(200, { data: [{ status: 'success' }] })
  ];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return responses.shift();
  };

  const result = await recordBriefDeliveryOnLead({
    email: 'person@example.com',
    pdfUrl: 'https://blob.example/brief.pdf',
    jobId: 'job-1',
    deliveredAt: '2026-09-04T15:30:00Z'
  });

  assert.equal(result.action, 'update');
  const update = calls[3];
  assert.equal(update.options.headers['If-Unmodified-Since'], '2026-09-04T15:00:00Z');
  const body = JSON.parse(update.options.body);
  assert.deepEqual(body.trigger, []);
  assert.match(body.data[0].Description, /https:\/\/blob\.example\/brief\.pdf/);
});

test('re-reads and retries after a conditional update conflict', async (t) => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  t.after(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });
  Object.assign(process.env, {
    ZOHO_REFRESH_TOKEN: 'refresh',
    ZOHO_CLIENT_ID: 'client',
    ZOHO_CLIENT_SECRET: 'secret',
    ZOHO_FETCH_TIMEOUT_MS: '100'
  });

  const responses = [
    jsonResponse(200, { access_token: 'token', api_domain: 'https://www.zohoapis.com' }),
    jsonResponse(200, { data: [{ id: 'lead-1', Description: 'Before', Modified_Time: 'time-1' }] }),
    jsonResponse(200, { access_token: 'token', api_domain: 'https://www.zohoapis.com' }),
    jsonResponse(412, { code: 'RECORD_LOCKED' }),
    jsonResponse(200, { access_token: 'token', api_domain: 'https://www.zohoapis.com' }),
    jsonResponse(200, { data: [{ id: 'lead-1', Description: 'Human update', Modified_Time: 'time-2' }] }),
    jsonResponse(200, { access_token: 'token', api_domain: 'https://www.zohoapis.com' }),
    jsonResponse(200, { data: [{ status: 'success' }] })
  ];
  global.fetch = async () => responses.shift();

  const result = await recordBriefDeliveryOnLead({
    email: 'person@example.com',
    pdfUrl: 'https://blob.example/brief.pdf',
    jobId: 'job-1',
    deliveredAt: '2026-09-04T15:30:00Z'
  });

  assert.equal(result.action, 'update');
  assert.equal(responses.length, 0);
});
