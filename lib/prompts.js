// Research / synthesis / insight prompts for the /try pipeline.
// Fact vs interpretation discipline enforced in every prompt: never state an
// inference as fact — use "may/could/appears to/suggests" language.

function researchPrompt({ name, site, role }) {
  return {
    system: `You are a research analyst. You research only PUBLICLY AVAILABLE information about the company named below: official site, press releases, verified social profiles, government/business records, news, industry publications. Never speculate about private data. Every claim must be traceable to a real, checkable public source. Return ONLY valid JSON, no prose outside the JSON.`,
    user: `Company: ${name}
Website: ${site || '(not provided)'}
Role in this report: ${role} (this is either "target" — the business running the scan — or "competitor")

Research this company's public presence: what it sells, who it appears to serve, recent public moves (launches, hires, funding, partnerships), how it presents itself publicly, and any public statements about AI.

Return JSON exactly in this shape:
{
  "company_name": "string",
  "findings": [
    { "claim": "string, factual, cites what was found", "is_inference": false, "source_url": "https://...", "source_label": "e.g. Official site, Press release, LinkedIn" }
  ]
}
Rules:
- Provide 4 to 6 findings.
- "claim" must be a single factual sentence. If you are inferring rather than quoting/observing directly, set "is_inference": true and phrase the claim with "appears to / may / could / suggests".
- "source_url" must be a real URL you actually used. Never fabricate a URL.
- No numeric scores, grades, or bands anywhere.`
  };
}

function synthesisPrompt({ target, comp1, comp2 }) {
  return {
    system: `You are a business analyst producing a comparison for an executive audience. Use only the research findings provided — do not introduce new facts. Return ONLY valid JSON.`,
    user: `Target company research:
${JSON.stringify(target, null, 2)}

Competitor 1 research:
${JSON.stringify(comp1, null, 2)}

Competitor 2 research:
${JSON.stringify(comp2, null, 2)}

Produce:
1. Exactly 4 "business_findings" about the TARGET company only (what a machine can currently tell about them from public info — legibility, positioning clarity, consistency).
2. Exactly 3 "competitive_findings_1" about Competitor 1, and exactly 3 "competitive_findings_2" about Competitor 2 — specifically what they have publicly said or done regarding AI, technology, or positioning that the target should know about.
3. At most 5 "comparison_categories" — each comparing target vs comp1 vs comp2 on one axis (e.g. "Public AI messaging", "Positioning clarity", "Recent public moves"). Never invent a category with no supporting research.

Return JSON exactly in this shape:
{
  "business_findings": [ { "claim": "string", "is_inference": false, "source_url": "...", "source_label": "..." } ],
  "competitive_findings_1": [ { "claim": "string", "is_inference": false, "source_url": "...", "source_label": "..." } ],
  "competitive_findings_2": [ { "claim": "string", "is_inference": false, "source_url": "...", "source_label": "..." } ],
  "comparison_categories": [ { "category": "string", "target": "string", "competitor_1": "string", "competitor_2": "string" } ]
}
Every claim must carry a source_url pulled from the research provided above — never fabricate one. Use "may/could/appears to/suggests" for anything not directly observed.`
  };
}

function insightsPrompt({ synthesis, target }) {
  return {
    system: `You are a strategic advisor. Base every insight strictly on the synthesis and research provided. Never state an inference as settled fact. Return ONLY valid JSON.`,
    user: `Target company: ${target.company_name}

Synthesis:
${JSON.stringify(synthesis, null, 2)}

Produce exactly 3 strategic insights. Each must pass the "so what" test — a busy owner should immediately see why it matters. Each insight has exactly these four parts:
- what_we_see: the observation, grounded in the research
- why_it_matters: the business consequence, phrased for an owner/principal, never with fabricated urgency
- what_you_may_want_to_do: a suggested next step, phrased as a possibility ("may want to / could consider"), never a guaranteed outcome or promise
- evidence: array of { "source_url": "...", "source_label": "..." } drawn only from the research/synthesis above

Return JSON exactly in this shape:
{
  "insights": [
    { "what_we_see": "string", "why_it_matters": "string", "what_you_may_want_to_do": "string", "evidence": [ { "source_url": "...", "source_label": "..." } ] }
  ]
}
Never claim a specific product outcome. Never mention pricing. Never name a certification or compliance badge.`
  };
}

module.exports = { researchPrompt, synthesisPrompt, insightsPrompt };
