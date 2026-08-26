// POST /api/try-process { jobId }
// Self-chaining pipeline engine. Each call advances one job by as many
// stages as it can, then (if not finished) triggers itself again so no
// single invocation has to run the whole pipeline in one shot.
const { waitUntil } = require('@vercel/functions');
const { query } = require('../lib/db');
const { callPerplexity, extractJson } = require('../lib/perplexity');
const { researchPrompt, synthesisPrompt, insightsPrompt } = require('../lib/prompts');
const { runQc, normalizeSynthesis } = require('../lib/qc');

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

// Research used to run as 3 sequential Perplexity calls inside one
// invocation. That alone could approach or exceed the 60s function budget
// (see vercel.json) even before counting rate-limit backoff, and a kill
// mid-way left the job stuck with zero DB write. Each of the 3 lookups is
// now its own stage with its own status, self-chained via a fresh fetch to
// this same endpoint (same handoff pattern already used for
// GENERATING_PDF -> try-deliver) so no single invocation ever has to cover
// more than one external call.
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
  const insights = await callWithRetry(() => insightsPrompt({ synthesis: job.synthesis, target: job.research_target }), 'insights');
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
// it by exactly one step. Kept as a lookup (not an if/else cascade) so each
// invocation performs at most one external call before either handing off
// to try-deliver or self-chaining back to this endpoint for the next stage.
const STAGE_RUNNERS = {
  SUBMITTED: runResearchTargetStage,
  RESEARCHING_COMP1: runResearchComp1Stage,
  RESEARCHING_COMP2: runResearchComp2Stage,
  SYNTHESIZING: runSynthesisStage,
  INSIGHTS: runInsightsStage,
  FACT_CHECKING: runQcStage
};

const TERMINAL_STATUSES = new Set(['NEEDS_REVIEW', 'DELIVERED', 'FAILED']);

async function triggerSelf(req, jobId) {
  const url = `${baseUrl(req)}/api/try-process`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId })
  }).catch((err) => console.error('try-process self-chain kickoff failed', err));
}

async function triggerDeliver(req, jobId) {
  const url = `${baseUrl(req)}/api/try-deliver`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId })
  }).catch((err) => console.error('try-deliver kickoff failed', err));
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

  // Respond immediately; do the work in the background via waitUntil so the
  // caller (try-submit, or the cron safety net) never has to wait on us.
  res.status(202).json({ ok: true, jobId, status: job.status });

  const work = (async () => {
    try {
      // Run exactly ONE stage per invocation. Running multiple sequential
      // Perplexity calls in a single call used to be able to exceed the 60s
      // function budget (see vercel.json), and a platform kill mid-stage
      // left the job stuck forever with no error ever written to the DB.
      // Bounding each invocation to one stage keeps it well under budget,
      // and the per-call timeout in lib/perplexity.js means any hang now
      // surfaces as a caught, recorded error instead of a silent kill.
      const runStage = STAGE_RUNNERS[job.status];
      if (runStage) {
        job = await runStage(job);
      }

      if (job.status === 'GENERATING_PDF') {
        // Hand off to the PDF/delivery stage as its own invocation so a slow
        // headless-render never blocks this function's budget.
        await triggerDeliver(req, jobId);
        return;
      }
      if (TERMINAL_STATUSES.has(job.status)) {
        return;
      }
      if (runStage) {
        // Advanced one stage and there's more to do — hand off the next
        // stage to a fresh invocation rather than continuing in this one.
        await triggerSelf(req, jobId);
      }
    } catch (err) {
      await markFailed(job, err).catch((e2) => console.error('markFailed also failed', e2));
    }
  })();

  waitUntil(work);
};
