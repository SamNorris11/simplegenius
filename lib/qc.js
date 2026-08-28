// Deterministic QC gate. Per the master spec: this MUST pass before a brief
// is ever emailed. If it fails, the job goes to NEEDS_REVIEW and nothing is sent.
// NOTE: compliance-certification phrases (soc 2, hipaa, iso 27001, gdpr
// compliant, ccpa compliant) were previously in this list to stop Simple
// Genius's own marketing copy from claiming a certification Trent hasn't
// confirmed. They do NOT belong here: per lib/prompts.js, business_findings,
// competitive_findings_1/2, and insights are exclusively factual statements
// ABOUT the target company and its named competitors, never about Simple
// Genius itself. A target or competitor genuinely being HIPAA compliant (a
// common, true, and often competitively relevant fact for benefits/insurance
// firms) is a legitimate finding, not a violation. Removing them here fixed
// a real bug where true competitive research was being blocked from
// delivery. If Simple Genius's own brand copy needs this ban, enforce it
// where that copy is generated/reviewed, not in this research QC gate.
const BANNED_PHRASES = [
  'guarantee', 'guaranteed', 'we will get you showing up in ai answers',
  'revolutionary', 'game-changing', 'game changing', 'disruptive', 'next level',
  'unlock', 'paradigm shift', 'cutting edge', 'seamless', 'effortless'
];

const INFERENCE_MARKERS = ['may', 'could', 'appears to', 'suggests', 'seems to', 'might'];

// Deterministic backstop against pure identifying trivia (no strategic
// weight) slipping into a finding despite the prompt-level instruction to
// avoid it. A street address or phone number is never itself a useful
// competitive insight, so any claim containing one fails QC outright and
// routes the job to NEEDS_REVIEW rather than auto-sending.
const STREET_ADDRESS_RE = /\b\d{1,6}\s+[A-Za-z0-9.'\- ]{2,40}\b(street|st\.?|avenue|ave\.?|boulevard|blvd\.?|drive|dr\.?|road|rd\.?|lane|ln\.?|way|court|ct\.?|circle|cir\.?|suite|ste\.?|parkway|pkwy\.?|highway|hwy\.?)\b/i;
const PHONE_NUMBER_RE = /\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}\b/;

function findTriviaViolation(text) {
  if (typeof text !== 'string') return null;
  if (STREET_ADDRESS_RE.test(text)) return 'street address';
  if (PHONE_NUMBER_RE.test(text)) return 'phone number';
  return null;
}

// The LLM is asked to set is_inference:true only when it also phrases the
// claim with hedge language (may/could/appears to/suggests/seems to/might).
// In practice it sometimes sets the flag on a claim that already reads as a
// plain factual statement. is_inference is metadata only (never rendered in
// the PDF template), so when the flag disagrees with the claim's own
// phrasing we trust the phrasing and correct the flag, rather than blocking
// a well-sourced, plainly-worded factual claim from ever being delivered.
// Pages 2 and 3 render inside the same fixed-height, overflow:hidden page
// container as the page-4 comparison table. Business findings (page 2) have
// room for a slightly longer claim than competitive findings (page 3),
// which pack 3 rows per competitor block x 2 blocks on one page. These caps
// are the deterministic backstop, same pattern as COMPARISON_CELL_MAX_CHARS
// below — the prompt asks for reasonably tight claims, but instructions are
// not a layout guarantee, and a too-long claim previously overlapped the
// page footer instead of being contained. Values verified by locally
// rendering worst-case (every claim at the max length) pages 2 and 3 through
// the real Chromium renderer and confirming no footer overlap with margin
// to spare.
const BUSINESS_FINDING_MAX_CHARS = 220;
const COMPETITIVE_FINDING_MAX_CHARS = 200;
// The tag renders inside a small fixed-width pill. CSS now wraps long tags
// instead of overflowing, but this caps the truly extreme case (the model
// writing a run-on label instead of a short category word/phrase).
const TAG_MAX_CHARS = 28;

function normalizeFindingArray(findings, maxChars) {
  if (!Array.isArray(findings)) return;
  findings.forEach((f) => {
    if (!f || typeof f.claim !== 'string') return;
    if (f.is_inference) {
      const lower = f.claim.toLowerCase();
      if (!INFERENCE_MARKERS.some((m) => lower.includes(m))) {
        f.is_inference = false;
      }
    }
    if (maxChars) {
      f.claim = truncateAtWordBoundary(f.claim, maxChars);
    }
    if (typeof f.tag === 'string' && f.tag.length > TAG_MAX_CHARS) {
      f.tag = truncateAtWordBoundary(f.tag, TAG_MAX_CHARS);
    }
  });
}

// The comparison table on page 4 renders inside a fixed-height page
// container (overflow: hidden) so it can never grow to a second page.
// The LLM is asked to keep each cell under 160 characters, but instructions
// are not a layout guarantee — this is the deterministic backstop that
// actually prevents the table from overflowing the page and getting clipped
// (which previously cut sentences off mid-word and let the cut text collide
// with the page footer).
//
// 2026-08-28 fix: a real generated brief showed the page footer overlapping
// the "How we built this table" caption box. Root cause was structural, not
// just long cells — at up to 5 comparison rows, even short realistic cells
// wrap to enough lines that the table + caption box run past the footer.
// First pass verified via the real Chromium renderer that 5 rows/200 chars
// overflowed by hundreds of px, and 5 rows/110 chars still overlapped by
// ~80px, so rows were capped at 4 and chars at 110 as the safe combination.
//
// 2026-08-28 follow-up: that cap traded away real content depth (Sam's
// feedback: "feels shorter"). Tightened .compare-table cell padding/
// line-height and .table-footnote-box padding in lib/brief-style.js instead
// (visually unchanged — just less dead vertical space per row), then
// re-verified via the same renderer with worst-case data: 5 rows at 200
// chars/cell still overflows onto the footer even with the tighter CSS, but
// 5 rows at 130 chars/cell now clears the footer with a clean margin. This
// restores the 5th comparison row while keeping a real, renderer-verified
// safety margin — not a guess.
const COMPARISON_CELL_MAX_CHARS = 130;
// Hard cap on rows rendered — independent backstop from the prompt's "at most
// 5" instruction, since that's guidance, not a layout guarantee. Required
// alongside the char cap above; see comment there.
const COMPARISON_MAX_ROWS = 5;

// Page 5 (Strategic Insights) renders 3 insight cards inside the same
// fixed-height, overflow:hidden page container as every other page. Unlike
// business/competitive findings and comparison cells, insight fields and
// the evidence-pill array had NO backstop at all -- a real delivered brief
// (job 6bfabcc7, Aug 2026) showed the 3rd card's evidence line wrapping to a
// second row (3 source pills instead of 2) combined with realistic ~250
// char field text, and that pushed the card bottom into the page footer.
// Verified via the real Chromium renderer with worst-case data (all 3
// fields at the cap on every card, headline at the cap, evidence at the cap
// on every card): fits with clear margin above the footer. Same pattern as
// COMPARISON_CELL_MAX_CHARS/COMPARISON_MAX_ROWS above.
const INSIGHT_FIELD_MAX_CHARS = 200;
const INSIGHT_HEADLINE_MAX_CHARS = 90;
const INSIGHT_MAX_EVIDENCE = 2;

function truncateAtWordBoundary(text, maxChars) {
  if (typeof text !== 'string' || text.length <= maxChars) return text;
  const hardCut = text.slice(0, maxChars);
  const lastSpace = hardCut.lastIndexOf(' ');
  const safeCut = lastSpace > maxChars * 0.6 ? hardCut.slice(0, lastSpace) : hardCut;
  return `${safeCut.replace(/[.,;:\s]+$/, '')}\u2026`;
}

function normalizeComparisonCategories(categories) {
  if (!Array.isArray(categories)) return;
  if (categories.length > COMPARISON_MAX_ROWS) {
    categories.length = COMPARISON_MAX_ROWS;
  }
  categories.forEach((row) => {
    if (!row) return;
    ['target', 'competitor_1', 'competitor_2'].forEach((field) => {
      if (typeof row[field] === 'string') {
        row[field] = truncateAtWordBoundary(row[field], COMPARISON_CELL_MAX_CHARS);
      }
    });
  });
}

function normalizeSynthesis(synthesis) {
  if (!synthesis) return synthesis;
  normalizeFindingArray(synthesis.business_findings, BUSINESS_FINDING_MAX_CHARS);
  normalizeFindingArray(synthesis.competitive_findings_1, COMPETITIVE_FINDING_MAX_CHARS);
  normalizeFindingArray(synthesis.competitive_findings_2, COMPETITIVE_FINDING_MAX_CHARS);
  normalizeComparisonCategories(synthesis.comparison_categories);
  return synthesis;
}

function normalizeInsights(insightsData) {
  if (!insightsData) return insightsData;
  const arr = insightsData.insights;
  if (!Array.isArray(arr)) return insightsData;
  arr.forEach((ins) => {
    if (!ins) return;
    if (typeof ins.headline === 'string') {
      ins.headline = truncateAtWordBoundary(ins.headline, INSIGHT_HEADLINE_MAX_CHARS);
    }
    ['what_we_see', 'why_it_matters', 'what_you_may_want_to_do'].forEach((field) => {
      if (typeof ins[field] === 'string') {
        ins[field] = truncateAtWordBoundary(ins[field], INSIGHT_FIELD_MAX_CHARS);
      }
    });
    if (Array.isArray(ins.evidence) && ins.evidence.length > INSIGHT_MAX_EVIDENCE) {
      ins.evidence.length = INSIGHT_MAX_EVIDENCE;
    }
  });
  return insightsData;
}

function isRealUrl(u) {
  return typeof u === 'string' && /^https?:\/\/[^\s]+\.[a-z]{2,}/i.test(u.trim());
}

function checkFinding(f, path, notes) {
  if (!f || typeof f.claim !== 'string' || !f.claim.trim()) {
    notes.push(`${path}: missing claim text.`);
    return;
  }
  if (!f.tag || !String(f.tag).trim()) {
    notes.push(`${path}: missing tag label.`);
  }
  if (!f.headline || !String(f.headline).trim()) {
    notes.push(`${path}: missing headline.`);
  }
  if (!isRealUrl(f.source_url)) {
    notes.push(`${path}: missing or invalid source_url ("${f.source_url}").`);
  }
  if (f.is_inference) {
    const lower = f.claim.toLowerCase();
    if (!INFERENCE_MARKERS.some((m) => lower.includes(m))) {
      notes.push(`${path}: flagged as inference but claim doesn't use may/could/appears to/suggests language.`);
    }
  }
  const lowerClaim = f.claim.toLowerCase();
  BANNED_PHRASES.forEach((phrase) => {
    if (lowerClaim.includes(phrase)) notes.push(`${path}: contains banned phrase "${phrase}".`);
  });
  const trivia = findTriviaViolation(f.claim);
  if (trivia) notes.push(`${path}: contains a ${trivia}, which has no strategic value — remove it.`);
}

function runQc({ synthesis, insights }) {
  normalizeSynthesis(synthesis);
  normalizeInsights(insights);
  const notes = [];

  // Exact counts per the master spec.
  if (!Array.isArray(synthesis?.business_findings) || synthesis.business_findings.length !== 4) {
    notes.push(`business_findings count is ${synthesis?.business_findings?.length ?? 0}, expected exactly 4.`);
  }
  if (!Array.isArray(synthesis?.competitive_findings_1) || synthesis.competitive_findings_1.length !== 3) {
    notes.push(`competitive_findings_1 count is ${synthesis?.competitive_findings_1?.length ?? 0}, expected exactly 3.`);
  }
  if (!Array.isArray(synthesis?.competitive_findings_2) || synthesis.competitive_findings_2.length !== 3) {
    notes.push(`competitive_findings_2 count is ${synthesis?.competitive_findings_2?.length ?? 0}, expected exactly 3.`);
  }
  if (!Array.isArray(synthesis?.comparison_categories) || synthesis.comparison_categories.length < 1 || synthesis.comparison_categories.length > 5) {
    notes.push(`comparison_categories count is ${synthesis?.comparison_categories?.length ?? 0}, expected 1 to 5.`);
  }
  if (!Array.isArray(insights?.insights) || insights.insights.length !== 3) {
    notes.push(`insights count is ${insights?.insights?.length ?? 0}, expected exactly 3.`);
  }

  // Per-item checks.
  (synthesis?.business_findings || []).forEach((f, i) => checkFinding(f, `business_findings[${i}]`, notes));
  (synthesis?.competitive_findings_1 || []).forEach((f, i) => checkFinding(f, `competitive_findings_1[${i}]`, notes));
  (synthesis?.competitive_findings_2 || []).forEach((f, i) => checkFinding(f, `competitive_findings_2[${i}]`, notes));

  if (!synthesis?.competitor_1_tagline || !String(synthesis.competitor_1_tagline).trim()) {
    notes.push('competitor_1_tagline: missing.');
  }
  if (!synthesis?.competitor_2_tagline || !String(synthesis.competitor_2_tagline).trim()) {
    notes.push('competitor_2_tagline: missing.');
  }

  (insights?.insights || []).forEach((ins, i) => {
    if (!ins?.headline || !String(ins.headline).trim()) {
      notes.push(`insights[${i}].headline: missing.`);
    }
    ['what_we_see', 'why_it_matters', 'what_you_may_want_to_do'].forEach((field) => {
      if (!ins?.[field] || !String(ins[field]).trim()) {
        notes.push(`insights[${i}].${field}: missing.`);
      }
    });
    if (!Array.isArray(ins?.evidence) || ins.evidence.length === 0) {
      notes.push(`insights[${i}].evidence: missing or empty.`);
    } else {
      ins.evidence.forEach((e, j) => {
        if (!isRealUrl(e?.source_url)) notes.push(`insights[${i}].evidence[${j}]: invalid source_url.`);
      });
    }
    const combinedRaw = `${ins?.what_we_see || ''} ${ins?.why_it_matters || ''} ${ins?.what_you_may_want_to_do || ''}`;
    const combined = combinedRaw.toLowerCase();
    BANNED_PHRASES.forEach((phrase) => {
      if (combined.includes(phrase)) notes.push(`insights[${i}]: contains banned phrase "${phrase}".`);
    });
    const trivia = findTriviaViolation(combinedRaw);
    if (trivia) notes.push(`insights[${i}]: contains a ${trivia}, which has no strategic value — remove it.`);
  });

  return { passed: notes.length === 0, notes };
}

module.exports = { runQc, normalizeSynthesis, normalizeInsights };
