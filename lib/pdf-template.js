// Dynamic brief PDF template.
// Takes a full brief_jobs row (with parsed JSONB fields) and returns a complete,
// self-contained HTML string (inline fonts + images as data URIs, no external
// network dependency at render time) for a 6-page brief PDF.
//
// CRITICAL: every field is per-job. Nothing here is hardcoded to any one company.
// Company/competitor NAMES used in headers/footers come directly from the job row
// (the human-submitted form data), never from LLM synthesis output, so there is no
// path for one company's identity to be swapped for another's even if the LLM
// mislabels something internally.

const images = require('./brief-assets/images');
const { getBriefCss } = require('./brief-style');

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHref(url) {
  if (!url || typeof url !== 'string') return '#';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '#';
    return esc(url);
  } catch (e) {
    return '#';
  }
}

function formatDate(d) {
  const date = d ? new Date(d) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function sourcePill(finding) {
  const href = safeHref(finding && finding.source_url);
  const label = esc((finding && finding.source_label) || 'source');
  return `<a class="source-pill" href="${href}" target="_blank" rel="noopener"><b>SOURCE</b> ${label} \u2197</a>`;
}

function renderFindingCard(f) {
  return `
      <div class="finding-card">
        <div class="finding-card-hdr">
          <span class="tag-pill">${esc(f && f.tag)}</span>
          ${sourcePill(f)}
        </div>
        <div class="finding-head">${esc(f && f.headline)}</div>
        <div class="finding-body">${esc(f && f.claim)}</div>
      </div>`;
}

function renderCfindRow(f) {
  return `
      <div class="cfind-row">
        <div class="cfind-tag-col"><span class="tag-pill">${esc(f && f.tag)}</span></div>
        <div class="cfind-content">
          <div class="cfind-hdr-line">
            <span class="cfind-head">${esc(f && f.headline)}</span>
            ${sourcePill(f)}
          </div>
          <div class="cfind-body">${esc(f && f.claim)}</div>
        </div>
      </div>`;
}

function renderCompetitorBlock(name, tagline, findings) {
  const rows = (findings || []).map(renderCfindRow).join('\n');
  return `
    <div class="competitor-block">
      <div class="competitor-hdr-full">
        <span class="competitor-name">${esc(name)}</span>
        <span class="competitor-tagline-inline">${esc(tagline)}</span>
      </div>
      ${rows}
    </div>`;
}

function renderCompareRow(row, targetLabel) {
  return `
        <tr>
          <th><span class="row-pill">${esc(row && row.category)}</span></th>
          <td class="you-col">${esc(row && row.target)}</td>
          <td>${esc(row && row.competitor_1)}</td>
          <td>${esc(row && row.competitor_2)}</td>
        </tr>`;
}

function renderInsightCard(insight, index) {
  const num = String(index + 1).padStart(2, '0');
  const evidence = (insight && insight.evidence) || [];
  const evidencePills = evidence.map((e) => sourcePill(e)).join('\n        ');
  return `
    <div class="insight-card">
      <div class="insight-card-hdr">
        <span class="insight-num">${num}</span>
        <span class="insight-headline">${esc(insight && insight.headline)}</span>
      </div>
      <div class="insight-cols">
        <div class="insight-col">
          <div class="insight-col-label">What we see</div>
          <div class="insight-col-text">${esc(insight && insight.what_we_see)}</div>
        </div>
        <div class="insight-col">
          <div class="insight-col-label">Why it matters</div>
          <div class="insight-col-text">${esc(insight && insight.why_it_matters)}</div>
        </div>
        <div class="insight-col">
          <div class="insight-col-label">What you may want to do</div>
          <div class="insight-col-text">${esc(insight && insight.what_you_may_want_to_do)}</div>
        </div>
      </div>
      <div class="evidence-line-sm">
        <span class="ev-label">Evidence</span>
        ${evidencePills}
      </div>
    </div>`;
}

/**
 * @param {object} job - a brief_jobs row, with JSONB columns already parsed to objects:
 *   { first_name, last_name, email, role, company, competitor1_name, competitor2_name,
 *     synthesis: { business_findings, competitive_findings_1, competitive_findings_2,
 *                  comparison_categories, competitor_1_tagline, competitor_2_tagline },
 *     insights: { insights: [...] },
 *     created_at }
 * @returns {string} full HTML document string
 */
function renderBriefHtml(job) {
  const company = (job && job.company) || 'Your Company';
  const competitor1Name = (job && job.competitor1_name) || 'Competitor 1';
  const competitor2Name = (job && job.competitor2_name) || 'Competitor 2';
  const firstName = (job && job.first_name) || '';
  const lastName = (job && job.last_name) || '';
  const role = (job && job.role) || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'You';
  const preparedFor = role ? `${fullName}, ${role}, ${company}` : `${fullName}, ${company}`;
  const dateLine = formatDate(job && job.created_at);

  const synthesis = (job && job.synthesis) || {};
  const insightsData = (job && job.insights) || {};

  const businessFindings = synthesis.business_findings || [];
  const compFindings1 = synthesis.competitive_findings_1 || [];
  const compFindings2 = synthesis.competitive_findings_2 || [];
  const comparisonCategories = synthesis.comparison_categories || [];
  const competitor1Tagline = synthesis.competitor_1_tagline || '';
  const competitor2Tagline = synthesis.competitor_2_tagline || '';
  const insights = insightsData.insights || [];

  const css = getBriefCss();
  const logo = images.logoHorizontalWhite;
  const icon = images.iconDark;

  const findingCards = businessFindings.map(renderFindingCard).join('\n');
  const competitorBlock1 = renderCompetitorBlock(competitor1Name, competitor1Tagline, compFindings1);
  const competitorBlock2 = renderCompetitorBlock(competitor2Name, competitor2Tagline, compFindings2);
  const compareRows = comparisonCategories.map((r) => renderCompareRow(r, company)).join('\n');
  const insightCards = insights.map(renderInsightCard).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Your Competitor Report: ${esc(company)}</title>
<style>${css}</style>
</head>
<body>

<!-- ============ PAGE 1 -- COVER ============ -->
<div class="page cover">
<div class="cover-inner">
  <img class="hero-logo" src="${logo}">
  <div class="rule"></div>
  <div class="brief-title">Your Competitor Report</div>
  <div class="company-name">${esc(company)}</div>
  <div class="prepared-block">
    <span class="label">Prepared for</span><span class="value">${esc(preparedFor)}</span>
  </div>
  <div class="date-line"><span class="label">Date</span><span class="value">${esc(dateLine)}</span></div>

  <div class="disclaimer-box">
    <div class="disclaimer-title">Built entirely from publicly available information</div>
    <div class="disclaimer-sub">No access to your systems. No conversations with your team. Nothing but what anyone can find.</div>
  </div>
</div>

<div class="cover-nav">
  <div class="cover-nav-label">Inside this report</div>
  <div class="cover-nav-items">
    <span>Your business</span><span class="sep">|</span><span>Your competitors</span><span class="sep">|</span><span>Where you look different</span><span class="sep">|</span><span>What we think matters</span>
  </div>
</div>
</div>

<!-- ============ PAGE 2 -- BUSINESS FINDINGS ============ -->
<div class="page interior">
  <div class="hdr">
    <div class="hdr-icon"><img src="${icon}"> <span>Your Competitor Report</span></div>
    <span>Business Findings</span>
  </div>
  <div class="body-area">
    <div class="eyebrow">What we found for ${esc(company)}</div>
    <h1 class="page-title">What we found about your business.</h1>
    <div class="page-subhead">Four things a stranger can learn about you in an afternoon.</div>

    <div class="findings-list">${findingCards}
    </div>

    <div class="footnote-box">Every finding above links to the page we found it on. None of it came from you.</div>
  </div>
  <div class="ftr"><span>${esc(company)}</span><span>02</span></div>
</div>

<!-- ============ PAGE 3 -- COMPETITIVE FINDINGS ============ -->
<div class="page interior">
  <div class="hdr">
    <div class="hdr-icon"><img src="${icon}"> <span>Your Competitor Report</span></div>
    <span>Competitive Findings</span>
  </div>
  <div class="body-area">
    <div class="eyebrow">What they are doing: two named competitors</div>
    <h1 class="page-title">What your competitors are doing.</h1>
    ${competitorBlock1}
    ${competitorBlock2}
  </div>
  <div class="ftr"><span>${esc(company)}</span><span>03</span></div>
</div>

<!-- ============ PAGE 4 -- COMPETITIVE VIEW TABLE ============ -->
<div class="page interior">
  <div class="hdr">
    <div class="hdr-icon"><img src="${icon}"> <span>Your Competitor Report</span></div>
    <span>Competitive View</span>
  </div>
  <div class="body-area">
    <div class="eyebrow">Where you look different</div>
    <h1 class="page-title">Where you look different.</h1>
    <div class="page-subhead">The same questions asked of all three companies, answered only from what each one says in public.</div>

    <table class="compare-table">
      <thead>
        <tr>
          <th></th>
          <th class="you-col">${esc(company)}</th>
          <th>${esc(competitor1Name)}</th>
          <th>${esc(competitor2Name)}</th>
        </tr>
      </thead>
      <tbody>${compareRows}
      </tbody>
    </table>

    <div class="table-footnote-box">
      <div class="tfb-label">How we built this table</div>
      <div class="tfb-text">We asked the same questions of all three companies and answered them only from what each one publishes: websites, job posts, news items, and social accounts. Your column is highlighted. Nothing in it came from you.</div>
    </div>
  </div>
  <div class="ftr"><span>${esc(company)}</span><span>04</span></div>
</div>

<!-- ============ PAGE 5 -- STRATEGIC INSIGHTS ============ -->
<div class="page interior">
  <div class="hdr">
    <div class="hdr-icon"><img src="${icon}"> <span>Your Competitor Report</span></div>
    <span>Strategic Insights</span>
  </div>
  <div class="body-area">
    <div class="eyebrow">Three things we would want to talk about</div>
    <h1 class="page-title">What we think matters.</h1>
    ${insightCards}
  </div>
  <div class="ftr"><span>${esc(company)}</span><span>05</span></div>
</div>

<!-- ============ PAGE 6 -- THE CLOSE ============ -->
<div class="page close-page">
  <div class="body-area" style="padding-top:0;">
    <div class="close-title">This is what we found from the outside.</div>
    <div class="close-subtitle">Now imagine what we could do from within.</div>
    <div class="close-intro">You gave us your company and two competitors. Everything in this report came from publicly available information.</div>

    <div class="close-compare">
      <div class="we-had">
        <div class="col-head">What We Had</div>
        <ul>
          <li>Your website</li>
          <li>Your public presence</li>
          <li>Two competitors</li>
        </ul>
      </div>
      <div class="goes-deeper">
        <div class="col-head">With Simple Genius</div>
        <ul>
          <li>Your people</li>
          <li>Your company knowledge</li>
          <li>Your competitors</li>
          <li>What matters</li>
          <li>What to do next</li>
        </ul>
      </div>
    </div>

    <a class="close-cta" href="https://simplegenius.com" target="_blank" rel="noopener">See Simple Genius with the full picture &rarr;</a>
    <div class="close-cta-sub">A seven minute walkthrough of what the full picture looks like. Book a call at the end if it makes sense.</div>
  </div>
  <img class="stacklogo-sm" src="${logo}">
</div>

</body>
</html>
`;
}

module.exports = { renderBriefHtml, esc, safeHref, formatDate };
