// Auto-generated brief stylesheet module.
// Combines dynamic @font-face rules (base64 WOFF2, no filesystem/network dependency)
// with the static, visually-approved CSS from brief/style.css.
const fonts = require('./brief-assets/fonts');

function buildFontFaceCss() {
  return `
@font-face { font-family: "Playfair Display"; src: url("${fonts.playfairRegular}") format("woff2"); font-weight: 400; }
@font-face { font-family: "Playfair Display"; src: url("${fonts.playfairBold}") format("woff2"); font-weight: 700; }
@font-face { font-family: "Playfair Display"; src: url("${fonts.playfairBlack}") format("woff2"); font-weight: 900; }
@font-face { font-family: "Inter"; src: url("${fonts.interRegular}") format("woff2"); font-weight: 400; }
@font-face { font-family: "Inter"; src: url("${fonts.interMedium}") format("woff2"); font-weight: 500; }
@font-face { font-family: "Inter"; src: url("${fonts.interSemiBold}") format("woff2"); font-weight: 600; }
@font-face { font-family: "Inter"; src: url("${fonts.interBold}") format("woff2"); font-weight: 700; }
`;
}

const STATIC_CSS = `:root {
  --charcoal: #1D1D1D;
  --gold: #D4AF37;
  --gold-text: #7A5F16;
  --blue: #1E324F;
  --cream: #F7F7F7;
  --steel: #5A5A5A;
}

@page {
  size: 8.5in 11in;
  margin: 0;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: "Inter", sans-serif;
  color: var(--charcoal);
  background: var(--cream);
  font-synthesis: none;
  -webkit-font-smoothing: antialiased;
}

.page {
  width: 8.5in;
  height: 11in;
  background: var(--cream);
  position: relative;
  padding: 0.85in 0.9in 0.8in 0.9in;
  break-after: page;
  page-break-after: always;
  overflow: hidden;
}
.page:last-child { break-after: avoid; page-break-after: avoid; }

/* ---------- shared header / footer for interior pages ---------- */
.page.interior { border-top: 5px solid var(--gold); }
.hdr {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-family: "Inter", sans-serif;
  font-size: 8.4pt;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--steel);
  padding-bottom: 9px;
  border-bottom: 1px solid rgba(29,29,29,0.16);
}
.hdr .hdr-icon { display:flex; align-items:center; gap: 7px; white-space: nowrap; }
.hdr .hdr-icon img { height: 18px; width: auto; flex-shrink: 0; }
.hdr > span:last-child { white-space: nowrap; }

.ftr {
  position: absolute;
  bottom: 0.5in;
  left: 0.9in;
  right: 0.9in;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 8.4pt;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--steel);
  padding-top: 8px;
  border-top: 1px solid rgba(29,29,29,0.14);
}

.body-area {
  padding-top: 0.4in;
}

/* ---------- typography helpers ---------- */
.eyebrow {
  font-family: "Inter", sans-serif;
  font-size: 9.5pt;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--gold-text);
}
h1.page-title {
  font-family: "Playfair Display", serif;
  font-weight: 900;
  font-size: 26pt;
  line-height: 1.18;
  color: var(--charcoal);
  margin-top: 6px;
  letter-spacing: 0.005em;
}
.page-subhead {
  font-family: "Inter", sans-serif;
  font-size: 11.5pt;
  color: var(--steel);
  margin-top: 6px;
}

a { color: var(--blue); text-decoration: none; }

/* pill badges: category tag + source pill, reused everywhere */
.tag-pill {
  display: inline-block;
  font-family: "Inter", sans-serif;
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gold-text);
  background: rgba(212,175,55,0.16);
  border: 1px solid rgba(212,175,55,0.45);
  border-radius: 20px;
  padding: 4px 11px;
  white-space: nowrap;
}
.cfind-tag-col .tag-pill { font-size: 7.2pt; letter-spacing: 0.05em; padding: 3.5px 9px; }
.source-pill {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  font-family: "Inter", sans-serif;
  font-size: 7.4pt;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--steel);
  background: #FFFFFF;
  border: 1px solid rgba(29,29,29,0.2);
  border-radius: 20px;
  padding: 3.5px 9px;
  text-decoration: none;
  white-space: nowrap;
  gap: 3px;
}
.source-pill b {
  font-weight: 700;
  color: var(--charcoal);
  letter-spacing: 0.08em;
  margin-right: 2px;
}

/* ---------- Page 1: cover ---------- */
.cover {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.85in 0.9in 0.6in 0.9in;
  text-align: center;
  background: var(--charcoal);
  position: relative;
  overflow: hidden;
}
.cover::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 7px;
  background: var(--gold);
}
.cover::after {
  content: "";
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 7px;
  background: var(--gold);
}
.cover-inner { display: block; position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.cover .hero-logo { display: block; width: 3.5in; height: auto; margin: 0 auto 0.56in auto; }
.cover .rule { display: block; width: 0.7in; height: 2px; background: var(--gold); margin: 0 auto 0.42in auto; }
.cover .brief-title {
  font-family: "Playfair Display", serif;
  font-weight: 900;
  font-size: 32pt;
  letter-spacing: 0.005em;
  color: var(--cream);
  line-height: 1.2;
}
.cover .company-name {
  margin-top: 0.2in;
  font-family: "Playfair Display", serif;
  font-weight: 700;
  font-style: italic;
  font-size: 18pt;
  color: var(--gold);
}
.cover .prepared-block, .cover .date-line {
  margin-top: 0.28in;
  display: flex;
  align-items: baseline;
  gap: 18px;
  font-family: "Inter", sans-serif;
  font-size: 11pt;
  color: var(--cream);
  padding: 0 0 8px 0;
  border-bottom: 1px solid rgba(247,247,247,0.18);
  max-width: 5.7in;
  margin-left: auto;
  margin-right: auto;
  text-align: left;
}
.cover .date-line { margin-top: 0; }
.cover .prepared-block .label, .cover .date-line .label { color: #8C8C8C; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; font-size: 8pt; flex-shrink: 0; width: 1.05in; white-space: nowrap; text-align: left; }
.cover .prepared-block .value, .cover .date-line .value { flex: 1; text-align: left; white-space: nowrap; }

.disclaimer-box {
  margin-top: 0.45in;
  border: 1.5px solid rgba(212,175,55,0.75);
  background: rgba(212,175,55,0.06);
  border-radius: 4px;
  padding: 16px 24px;
  max-width: 5.4in;
}
.disclaimer-title {
  font-family: "Playfair Display", serif;
  font-weight: 700;
  font-style: italic;
  font-size: 13pt;
  color: var(--gold);
}
.disclaimer-sub {
  margin-top: 6px;
  font-family: "Inter", sans-serif;
  font-size: 9.5pt;
  line-height: 1.4;
  color: #B8B8B8;
}

.cover-nav {
  position: relative;
  z-index: 1;
  padding-top: 0.28in;
  border-top: 1px solid rgba(247,247,247,0.16);
  text-align: center;
}
.cover-nav-label {
  font-family: "Inter", sans-serif;
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 10px;
}
.cover-nav-items {
  font-family: "Inter", sans-serif;
  font-size: 10pt;
  color: #C7C7C7;
}
.cover-nav-items .sep { color: #5A5A5A; margin: 0 12px; }

/* ---------- Page 2: business findings ---------- */
.findings-list {
  display: flex;
  flex-direction: column;
  gap: 0.12in;
  margin-top: 0.2in;
}
.finding-card {
  border: 1px solid rgba(29,29,29,0.14);
  border-left: 3px solid var(--gold);
  border-radius: 4px;
  background: #FFFFFF;
  padding: 0.13in 0.22in;
}
.finding-card-hdr {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 9px;
}
.finding-head {
  font-family: "Playfair Display", serif;
  font-weight: 700;
  font-size: 14.5pt;
  line-height: 1.2;
  color: var(--charcoal);
  margin-bottom: 5px;
}
.finding-body {
  font-family: "Inter", sans-serif;
  font-size: 11pt;
  line-height: 1.38;
  color: #34322E;
}

.footnote-box {
  margin-top: 0.1in;
  border: 1px solid rgba(212,175,55,0.45);
  background: rgba(212,175,55,0.08);
  border-radius: 4px;
  padding: 10px 18px;
  text-align: center;
  font-family: "Inter", sans-serif;
  font-size: 10pt;
  font-style: italic;
  color: var(--gold-text);
}

/* ---------- Page 3: competitive findings ---------- */
.competitor-block {
  margin-top: 0.15in;
  border: 1px solid rgba(29,29,29,0.14);
  border-radius: 4px;
  background: #FFFFFF;
  overflow: hidden;
}
.competitor-hdr-full {
  background: var(--charcoal);
  border-left: 4px solid var(--gold);
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 8px 18px;
}
.competitor-name {
  font-family: "Playfair Display", serif;
  font-weight: 700;
  font-size: 13.5pt;
  color: #FFFFFF;
  line-height: 1.2;
  white-space: nowrap;
}
.competitor-tagline-inline {
  font-family: "Inter", sans-serif;
  font-size: 8.8pt;
  color: #B8B8B8;
  line-height: 1.3;
  text-align: right;
}
.cfind-row {
  display: flex;
  gap: 18px;
  padding: 9px 18px;
  border-bottom: 1px solid rgba(29,29,29,0.1);
}
.cfind-row:last-child { border-bottom: none; }
.cfind-tag-col { width: 1.12in; flex-shrink: 0; padding-top: 2px; }
.cfind-content { flex: 1; min-width: 0; }
.cfind-hdr-line { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: nowrap; }
.cfind-head {
  font-family: "Playfair Display", serif;
  font-weight: 700;
  font-size: 9.8pt;
  line-height: 1.18;
  color: var(--charcoal);
  flex: 1;
  min-width: 0;
}
.cfind-body {
  margin-top: 3px;
  font-family: "Inter", sans-serif;
  font-size: 9.4pt;
  line-height: 1.28;
  color: #34322E;
}

/* ---------- Page 4: comparison table ---------- */
.compare-table {
  margin-top: 0.24in;
  width: 100%;
  border-collapse: collapse;
  border: 1px solid rgba(29,29,29,0.14);
}
.compare-table th, .compare-table td { border-right: 1px solid rgba(29,29,29,0.1); }
.compare-table th:last-child, .compare-table td:last-child { border-right: none; }
.compare-table tbody th { background: rgba(29,29,29,0.045); }
.compare-table th, .compare-table td {
  text-align: left;
  vertical-align: top;
  padding: 9px 13px;
  font-family: "Inter", sans-serif;
}
.compare-table thead th {
  font-family: "Playfair Display", serif;
  font-weight: 700;
  font-size: 12.5pt;
  color: var(--charcoal);
  border-bottom: 1.5px solid var(--charcoal);
  padding-top: 9px;
  padding-bottom: 9px;
}
.compare-table thead th.you-col {
  color: #FFFFFF;
  background: var(--charcoal);
  border-radius: 4px 4px 0 0;
  border-bottom: none;
}
.compare-table thead th:first-child { border-bottom: none; }
.compare-table tbody th {
  padding-top: 12px;
  width: 15%;
}
.row-pill {
  display: inline-block;
  background: var(--charcoal);
  color: #FFFFFF;
  font-family: "Inter", sans-serif;
  font-size: 7.6pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 4px 9px;
  border-radius: 20px;
  white-space: nowrap;
}
.compare-table tbody td {
  font-size: 11pt;
  line-height: 1.28;
  color: #2B2A27;
  border-bottom: 1px solid rgba(29,29,29,0.1);
  width: 28.3%;
}
.compare-table tbody th { border-bottom: 1px solid rgba(29,29,29,0.1); }
.compare-table tbody td.you-col { background: rgba(212,175,55,0.08); font-weight: 500; border-left: 3px solid var(--gold); padding-left: 11px; }
.compare-table tbody tr:first-child td, .compare-table tbody tr:first-child th { padding-top: 12px; }

.table-footnote-box {
  margin-top: 0.22in;
  border: 1px solid rgba(29,29,29,0.14);
  border-left: 3px solid var(--gold);
  background: #FFFFFF;
  border-radius: 4px;
  padding: 12px 18px;
}
.tfb-label {
  font-family: "Inter", sans-serif;
  font-size: 8.6pt;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--gold-text);
  margin-bottom: 4px;
}
.tfb-text {
  font-family: "Inter", sans-serif;
  font-size: 10pt;
  line-height: 1.4;
  color: #34322E;
}

/* ---------- Page 5: strategic insights (merged, 3-up columns) ---------- */
.insight-card {
  border: 1px solid rgba(29,29,29,0.14);
  border-radius: 4px;
  background: #FFFFFF;
  padding: 0.11in 0.18in;
  margin-top: 0.13in;
}
.insight-card-hdr {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 0.07in;
  padding-bottom: 0.06in;
  border-bottom: 1px solid rgba(29,29,29,0.12);
}
.insight-num {
  font-family: "Playfair Display", serif;
  font-weight: 900;
  font-size: 12.5pt;
  color: var(--gold-text);
  flex-shrink: 0;
}
.insight-headline {
  font-family: "Playfair Display", serif;
  font-weight: 700;
  font-size: 11.5pt;
  line-height: 1.18;
  color: var(--charcoal);
}
.insight-cols {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.18in;
}
.insight-col-label {
  font-family: "Inter", sans-serif;
  font-size: 7.6pt;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--gold-text);
  margin-bottom: 3px;
}
.insight-col-text {
  font-family: "Inter", sans-serif;
  font-size: 8.4pt;
  line-height: 1.26;
  color: #34322E;
}
.evidence-line-sm {
  margin-top: 0.07in;
  padding-top: 0.055in;
  border-top: 1px solid rgba(29,29,29,0.1);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px 7px;
}
.evidence-line-sm .ev-label {
  font-family: "Inter", sans-serif;
  font-size: 8pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--steel);
  margin-right: 2px;
}

/* ---------- Page 6: close ---------- */
.close-page {
  text-align: center;
  background: var(--charcoal);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.close-page .body-area {
  transform: translateY(-0.7in);
}
.close-page::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 7px;
  background: var(--gold);
}
.close-page::after {
  content: "";
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 7px;
  background: var(--gold);
}
.close-page .close-title {
  font-family: "Playfair Display", serif;
  font-weight: 900;
  font-size: 23pt;
  color: var(--cream);
  line-height: 1.24;
  max-width: 5.6in;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}
.close-page .close-subtitle {
  margin-top: 0.1in;
  font-family: "Playfair Display", serif;
  font-weight: 700;
  font-style: italic;
  font-size: 15pt;
  color: var(--gold);
  position: relative;
  z-index: 1;
}
.close-page .close-intro {
  margin-top: 0.17in;
  font-family: "Inter", sans-serif;
  font-size: 13pt;
  line-height: 1.5;
  color: #C7C7C7;
  max-width: 6.1in;
  margin-left: auto;
  margin-right: auto;
  position: relative;
  z-index: 1;
}
.close-compare {
  margin-top: 0.4in;
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 0.5in;
  text-align: left;
  max-width: 6.5in;
  margin-left: auto;
  margin-right: auto;
  position: relative;
  z-index: 1;
}
.close-compare .we-had, .close-compare .goes-deeper {
  border: 1px solid #3A3A3A;
  border-radius: 3px;
  padding: 0.22in 0.24in;
}
.close-compare .goes-deeper { border: 1px solid var(--gold); background: rgba(212,175,55,0.05); }
.close-compare .col-head {
  font-family: "Inter", sans-serif;
  font-size: 10pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 12px;
}
.close-compare .we-had .col-head { color: #8C8C8C; }
.close-compare .goes-deeper .col-head { color: var(--gold); }
.close-compare ul { list-style: none; }
.close-compare li {
  font-family: "Inter", sans-serif;
  font-size: 11.5pt;
  line-height: 1.7;
  color: #C7C7C7;
}
.close-compare .we-had li { color: #8C8C8C; }
.close-compare .goes-deeper li { color: var(--cream); font-weight: 500; }
.close-compare li::before { content: "\\2022\\00A0\\00A0"; color: var(--gold); }

.close-cta {
  margin-top: 0.45in;
  display: inline-block;
  font-family: "Inter", sans-serif;
  font-weight: 700;
  font-size: 12.5pt;
  letter-spacing: 0.01em;
  color: var(--charcoal);
  background: var(--gold);
  padding: 13px 28px;
  border-radius: 3px;
  text-decoration: none;
  position: relative;
  z-index: 1;
}
.close-cta-sub {
  margin-top: 0.14in;
  font-family: "Inter", sans-serif;
  font-size: 9.5pt;
  line-height: 1.4;
  color: #9A9A9A;
  max-width: 4.6in;
  margin-left: auto;
  margin-right: auto;
  position: relative;
  z-index: 1;
}
.close-page .stacklogo-sm {
  position: absolute;
  bottom: 0.4in;
  left: 0;
  right: 0;
  margin: 0 auto;
  width: 2.15in;
  display: block;
}
`;

function getBriefCss() {
  return buildFontFaceCss() + STATIC_CSS;
}

module.exports = { getBriefCss };
