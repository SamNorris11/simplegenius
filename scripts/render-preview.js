// Local QA helper: render the brief HTML with worst-case mock data, run it
// through the real normalizeSynthesis() QC backstop (same as production),
// so we can visually check header/footer overlap without needing serverless
// Chromium. Not part of the deployed app.
const { renderBriefHtml } = require('../lib/pdf-template');
const { normalizeSynthesis } = require('../lib/qc');
const fs = require('fs');

const WORDS = ['the','a','of','to','and','in','is','for','with','on','has','its','all','are','not','who','you','we',
  'leads','messaging','across','public','content','sites','recently','launched','a','new','feature','set','for',
  'large','self','funded','employer','groups','and','continues','to','expand','its','multi','state','footprint',
  'through','active','hiring','and','frequent','press','coverage','of','product','updates','while','emphasizing',
  'data','driven','risk','scoring','as','its','core','differentiator','in','the','market'];

function realisticSentence(targetLen) {
  let out = '';
  let i = 0;
  while (out.length < targetLen) {
    out += (out ? ' ' : '') + WORDS[i % WORDS.length];
    i++;
  }
  return out.slice(0, targetLen - 1).replace(/\s+\S*$/, '') + '.';
}

function longFinding(tag, headline, claimLen) {
  return {
    tag,
    headline,
    claim: realisticSentence(claimLen),
    is_inference: false,
    source_url: 'https://example.com/source-page',
    source_label: 'Official site',
  };
}

// Deliberately worst-case: 5 rows submitted by the "model" (over the new
// prompt's max of 4) at the OLD 160/200-char lengths, to prove the QC
// backstop (not just the prompt instruction) is what keeps this safe.
const job = {
  company: 'Self Insured Reporting',
  competitor1_name: 'Springbuk',
  competitor2_name: 'Innovu',
  first_name: 'Mark',
  last_name: 'Combs',
  role: 'CEO',
  created_at: '2026-08-27',
  synthesis: {
    business_findings: [
      longFinding('Specialty', 'Deep niche focus on self-funded plans', 220),
      longFinding('Hiring Signal', 'Actively hiring across three roles', 220),
      longFinding('Recognition', 'Recently recognized in an industry list', 220),
      longFinding('History', 'Multi-decade operating history in the space', 220),
    ],
    competitive_findings_1: [
      longFinding('Footprint', 'Wide multi-state footprint', 200),
      longFinding('Positioning', 'Leads with health intelligence messaging', 200),
      longFinding('Content', 'Publishes frequent case studies', 200),
    ],
    competitive_findings_2: [
      longFinding('Content', 'Publishes frequent thought leadership content', 200),
      longFinding('Hiring', 'Hiring for AI and data roles', 200),
      longFinding('Positioning', 'Leads with multi domain analytics messaging', 200),
    ],
    comparison_categories: [1, 2, 3, 4, 5].map((n) => ({
      category: `Category ${n} Strategic Axis Name`,
      target: realisticSentence(200),
      competitor_1: realisticSentence(200),
      competitor_2: realisticSentence(200),
    })),
    competitor_1_tagline: 'Health intelligence platform for benefits teams',
    competitor_2_tagline: 'AI powered multi domain benefits risk analytics',
  },
  insights: {
    insights: [1, 2, 3].map((n) => ({
      headline: `Strategic insight number ${n} about the competitive picture`,
      what_we_see: realisticSentence(150),
      why_it_matters: realisticSentence(150),
      what_you_may_want_to_do: realisticSentence(150),
      evidence: [
        { source_url: 'https://example.com/a', source_label: 'Official site' },
        { source_url: 'https://example.com/b', source_label: 'News item' },
      ],
    })),
  },
};

// This is the step production always runs before rendering (api/try-process.js).
normalizeSynthesis(job.synthesis);
console.log('rows after normalize:', job.synthesis.comparison_categories.length);
console.log('max cell len after normalize:', Math.max(...job.synthesis.comparison_categories.map(r => Math.max(r.target.length, r.competitor_1.length, r.competitor_2.length))));

const html = renderBriefHtml(job);
fs.writeFileSync('/home/user/workspace/screenpal_review/preview.html', html);
console.log('wrote preview.html, length', html.length);
