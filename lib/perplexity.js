// Thin wrapper around the Perplexity (Sonar) API.
// Requires PERPLEXITY_API_KEY set in the Vercel project's environment variables.
const PPLX_URL = 'https://api.perplexity.ai/chat/completions';

// A single invocation of the try-process pipeline has a hard 60s platform
// timeout (see vercel.json). Without a client-side timeout, a slow/hanging
// Perplexity response can get the whole function killed by the platform
// with nothing ever written to the DB — the job just sits there forever
// with no error recorded. This bounds every call well under that budget so
// a hang always surfaces as a normal thrown error the caller can catch,
// record (attempts/last_error), and retry, instead of vanishing silently.
const DEFAULT_TIMEOUT_MS = 40000;

async function callPerplexity({ system, user, model = 'sonar-pro', temperature = 0.2, timeoutMs }) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is not set in this environment.');
  }

  const timeout = timeoutMs || Number(process.env.PERPLEXITY_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(PPLX_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      }),
      signal: controller.signal
    });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error(`Perplexity API request timed out after ${timeout}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Perplexity API error ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const citations = data?.citations || data?.search_results?.map((r) => r.url) || [];
  if (data?.usage) console.log('PPLX_USAGE', model, JSON.stringify(data.usage));
  return { content, citations, raw: data, usage: data?.usage || null };
}

// Extracts the first JSON object/array found in a model response, tolerating
// markdown code fences and leading/trailing prose.
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[\{\[]/);
  if (start === -1) throw new Error('No JSON found in model response.');
  // Walk from the end to find the matching closing brace/bracket.
  const openChar = candidate[start];
  const closeChar = openChar === '{' ? '}' : ']';
  const end = candidate.lastIndexOf(closeChar);
  if (end === -1) throw new Error('No closing JSON delimiter found in model response.');
  const jsonStr = candidate.slice(start, end + 1);
  return JSON.parse(jsonStr);
}

module.exports = { callPerplexity, extractJson };
