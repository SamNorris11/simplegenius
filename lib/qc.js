// Deterministic QC gate. Per the master spec: this MUST pass before a brief
// is ever emailed. If it fails, the job goes to NEEDS_REVIEW and nothing is sent.
const BANNED_PHRASES = [
  'soc 2', 'soc2', 'hipaa', 'iso 27001', 'gdpr compliant', 'ccpa compliant',
  'guarantee', 'guaranteed', 'we will get you showing up in ai answers',
  'revolutionary', 'game-changing', 'game changing', 'disruptive', 'next level',
  'unlock', 'paradigm shift', 'cutting edge', 'seamless', 'effortless'
];

const INFERENCE_MARKERS = ['may', 'could', 'appears to', 'suggests', 'seems to', 'might'];

function isRealUrl(u) {
  return typeof u === 'string' && /^https?:\/\/[^\s]+\.[a-z]{2,}/i.test(u.trim());
}

function checkFinding(f, path, notes) {
  if (!f || typeof f.claim !== 'string' || !f.claim.trim()) {
    notes.push(`${path}: missing claim text.`);
    return;
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
}

function runQc({ synthesis, insights }) {
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

  (insights?.insights || []).forEach((ins, i) => {
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
    const combined = `${ins?.what_we_see || ''} ${ins?.why_it_matters || ''} ${ins?.what_you_may_want_to_do || ''}`.toLowerCase();
    BANNED_PHRASES.forEach((phrase) => {
      if (combined.includes(phrase)) notes.push(`insights[${i}]: contains banned phrase "${phrase}".`);
    });
  });

  return { passed: notes.length === 0, notes };
}

module.exports = { runQc };
