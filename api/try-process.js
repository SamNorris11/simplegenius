// POST /api/try-process { jobId }
// Runs a job forward through as many pipeline stages as are ready, all
// in-process within a single invocation, then (only for the final PDF
// hand-off) makes one outbound call to try-deliver.
//
// History: this used to self-chain via repeated outbound fetches to this
// same endpoint, one per stage, each awaited before responding (or,
// briefly, deferred via waitUntil). Both patterns stalled silently in
// live testing -- the job would sit at a status forever with
// attempts:0/last_error:null, meaning the invocation was torn down mid
// self-fetch before any retry/catch code ever ran. That happened whether
// the fetch was awaited synchronously or deferred with waitUntil.
//
// The actual fix: stop making the interior stages talk to each other over
// HTTP at all. RESEARCHING_* / SYNTHESIZING / INSIGHTS / FACT_CHECKING are
// all plain async functions with no special runtime needs (no chromium,
// no extra memory), so there was never a real reason to hop to a fresh
// invocation between them -- looping over them in-process removes the
// self-fetch reliability problem for the entire interior of the pipeline.
// Fluid Compute is enabled on this project (verified via the Vercel
// project API), which raises Hobby's function budget to up to 300s, so a
// handful of sequential Perplexity calls (each capped at 40s, see
// lib/perplexity.js) comfortably fits in one invocation. See vercel.json
// for the matching maxDuration bump.
//
// try-deliver.js is left as the one genuine external hop, because it
// needs a different runtime profile (2GB memory, headless chromium) and
// already runs fully synchronously end to end (it only responds once the
// PDF is rendered, uploaded, and the lead is synced/emailed).
const { query } = require('../lib/db');
const { callPerplexity, extractJson } = require('../lib/perplexity');
const { researchPrompt, synthesisPrompt, insightsPrompt } = require('../lib/prompts');
const { runQc, normalizeSynthesis, normalizeInsights } = require('../lib/qc');

const MAX_ATTEMPTS = 3;

function trimTrailingSlash(s) {
  return typeof s === 'string' ? s.replace(/\/+$/, '') : s;
}

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return trimTrailingSlash(process.env.PUBLIC_BASE_URL);
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host || process.env.VERCEL_URL;
  const proto = req?.headers?.['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

async function getJob(id) {
  const { rows } = await query('SELECT * FROM brief_jobs WHERE id = $1', [id]);
  return rows[0] || null;
}

async function setStatus(id, status, patch = {}) {
  const cols = Object.keys(patch);
  const setSql = cols.map((c, i) => `${c} = $${i + 3}`).join(', ');
  const vals = cols.map((c) => patch[c]);
  await query(
    `UPDATE brief_jobs SET status = $2, updated_at = now()${setSql ? ', ' + setSql : ''} WHERE id = $1`,
    [id, status, ...vals]
  );
}

async function markFailed(job, err) {
  console.error(`job ${job.id} failed at status ${job.status}`, err);
  const attempts = (job.attempts || 0) + 1;
  const status = attempts >= MAX_ATTEMPTS ? 'FAILED' : job.status; // stay put for cron/retry unless exhausted
  await query(
    'UPDATE brief_jobs SET attempts = $2, last_error = $3, status = $4, updated_at = now() WHERE id = $1',
    [job.id, attempts, String(err?.message || err).slice(0, 1000), status]
  );
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function callWithRetry(promptFn, label) {
  let lastErr;
  for (let i = 0; i < 4; i++) {
    try {
      const { content } = await callPerplexity(promptFn());
      return extractJson(content);
    } catch (err) {
      lastErr = err;
      const isRateLimit = /429|rate limit/i.test(String(err?.message || ''));
      if (!isRateLimit) throw err;
      console.warn(`${label}: rate limited, retrying in ${(i + 1) * 3}s`);
      await sleep((i + 1) * 3000);
    }
  }
  throw lastErr;
}

// Each stage does its one external call (if any), writes its result to the
// DB immediately, and returns the updated in-memory job. Writing to the DB
// after every single stage (not just at the end of the loop) means that
// even if this invocation were ever killed mid-loop, whatever stages
// already completed are durably saved and a fresh call to this endpoint
// picks up exactly where it left off -- no work is silently lost.
async function runResearchTargetStage(job) {
  const target = await callWithRetry(() => researchPrompt({ name: job.company, site: job.website, role: 'target' }), 'target');
  await setStatus(job.id, 'RESEARCHING_COMP1', { research_target: JSON.stringify(target) });
  return { ...job, status: 'RESEARCHING_COMP1', research_target: target };
}

async function runResearchComp1Stage(job) {
  const comp1 = await callWithRetry(() => researchPrompt({ name: job.competitor1_name, site: job.competitor1_site, role: 'competitor' }), 'comp1');
  await setStatus(job.id, 'RESEARCHING_COMP2', { research_competitor1: JSON.stringify(comp1) });
  return { ...job, status: 'RESEARCHING_COMP2', research_competitor1: comp1 };
}

async function runResearchComp2Stage(job) {
  const comp2 = await callWithRetry(() => researchPrompt({ name: job.competitor2_name, site: job.competitor2_site, role: 'competitor' }), 'comp2');
  await setStatus(job.id, 'SYNTHESIZING', { research_competitor2: JSON.stringify(comp2) });
  return { ...job, status: 'SYNTHESIZING', research_competitor2: comp2 };
}

async function runSynthesisStage(job) {
  const target = job.research_target;
  const comp1 = job.research_competitor1;
  const comp2 = job.research_competitor2;
  const synthesis = normalizeSynthesis(await callWithRetry(() => synthesisPrompt({ target, comp1, comp2 }), 'synthesis'));
  await setStatus(job.id, 'INSIGHTS', { synthesis: JSON.stringify(synthesis) });
  return { ...job, status: 'INSIGHTS', synthesis };
}

async function runInsightsStage(job) {
  const insights = normalizeInsights(await callWithRetry(() => insightsPrompt({ synthesis: job.synthesis, target: job.research_target }), 'insights'));
  await setStatus(job.id, 'FACT_CHECKING', { insights: JSON.stringify(insights) });
  return { ...job, status: 'FACT_CHECKING', insights };
}

async function runQcStage(job) {
  const qc = runQc({ synthesis: job.synthesis, insights: job.insights });
  if (!qc.passed) {
    await setStatus(job.id, 'NEEDS_REVIEW', { qc_result: JSON.stringify(qc) });
    return { ...job, status: 'NEEDS_REVIEW', qc_result: qc };
  }
  await setStatus(job.id, 'GENERATING_PDF', { qc_result: JSON.stringify(qc) });
  return { ...job, status: 'GENERATING_PDF', qc_result: qc };
}

// Maps a job's current status to the single stage function that advances
// it by exactly one step. All of these run in-process in the loop below --
// none of them is an HTTP hop.
const STAGE_RUNNERS = {
  SUBMITTED: runResearchTargetStage,
  RESEARCHING_COMP1: runResearchComp1Stage,
  RESEARCHING_COMP2: runResearchComp2Stage,
  SYNTHESIZING: runSynthesisStage,
  INSIGHTS: runInsightsStage,
  FACT_CHECKING: runQcStage
};

const TERMINAL_STATUSES = new Set(['NEEDS_REVIEW', 'DELIVERED', 'FAILED']);

// The one remaining outbound self-referential call in this file. Retried
// with backoff; if it still can't get through, the failure is written to
// the DB (attempts/last_error) via markFailed so the job is at least
// visibly stuck instead of silently vanishing, and a manual or future
// automated re-call to this same endpoint will retry the hand-off (a job
// already at GENERATING_PDF just re-fires this call; try-deliver itself is
// idempotent-safe to re-invoke for the same jobId).
async function triggerDeliverWithRetry(req, jobId, job) {
  const url = `${baseUrl(req)}/api/try-deliver`;
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });
      return;
    } catch (err) {
      lastErr = err;
      console.error(`try-deliver kickoff attempt ${i + 1} failed`, err);
      if (i < 2) await sleep(1000 * (i + 1));
    }
  }
  await markFailed(job, new Error(`try-deliver kickoff failed after retries: ${lastErr?.message || lastErr}`))
    .catch((e2) => console.error('markFailed also failed', e2));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const jobId = req.body?.jobId || (typeof req.body === 'string' ? JSON.parse(req.body).jobId : null);
  if (!jobId) return res.status(400).json({ ok: false, error: 'jobId required' });

  let job = await getJob(jobId);
  if (!job) return res.status(404).json({ ok: false, error: 'job not found' });

  try {
    // Advance through every ready stage in one loop, in-process. Each
    // iteration is one bounded external call (<=40s) plus a DB write, so
    // even a handful of stages back to back stays well inside the 280s
    // budget set for this function in vercel.json (Fluid Compute is
    // enabled on this project, which raises Hobby's ceiling to 300s).
    let runStage;
    while ((runStage = STAGE_RUNNERS[job.status])) {
      job = await runStage(job);
      if (TERMINAL_STATUSES.has(job.status) || job.status === 'GENERATING_PDF') break;
    }

    if (job.status === 'GENERATING_PDF') {
      await triggerDeliverWithRetry(req, jobId, job);
    }
  } catch (err) {
    await markFailed(job, err).catch((e2) => console.error('markFailed also failed', e2));
    return res.status(202).json({ ok: true, jobId, status: job.status, error: String(err?.message || err) });
  }

  return res.status(202).json({ ok: true, jobId, status: job.status });
};
