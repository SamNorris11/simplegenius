# 🔒 SIMPLEGENIUS.COM — SOURCE OF TRUTH

**This folder is the live site. Do not edit outside Computer. Do not deploy from anywhere else.**

Last verified production deploy: 2026-06-08
- Live URL: https://www.simplegenius.com
- Vercel project: `sam-9671s-projects/simple-genius`
- Latest deploy: `simple-genius-nie8wt2r1`

---

## What lives here

| Path | Purpose |
|---|---|
| `*.html` | All public pages (index, book, contact-us, pricing, product, about-us, resources, data-protection) |
| `css/` | Stylesheets — main, base, tokens, cluely-intro |
| `js/main.js` | Form submit handler, nav, general JS |
| `js/cluely-intro.js` | Hero word-mask Z-fly animation |
| `images/` | All site images |
| `api/submit-lead.js` | **Form endpoint** — posts to Zoho web-to-lead + ActiveCampaign |
| `api/newsletter-subscribe.js` | Newsletter signup → AC list 3 / tag 22 |
| `vercel.json` | `cleanUrls: true` — strips `.html` from URLs |
| `package.json` | Node ≥ 18 |
| `.vercel/` | Links this folder to the prod Vercel project — **DO NOT TOUCH** |

---

## How to deploy (the ONLY safe way)

From inside Computer, ask Sam-style ("push this to live"). The agent runs:

```bash
cd /home/user/workspace/simplegenius-source && \
  npx vercel --token $VERCEL_TOKEN deploy --prod --scope sam-9671s-projects --yes
```

For a preview (no live change):

```bash
cd /home/user/workspace/simplegenius-source && \
  npx vercel --token $VERCEL_TOKEN deploy --scope sam-9671s-projects --yes
```

**Never deploy a different folder.** A folder without `api/` will wipe form submission. A folder with the wrong `.vercel/` link will deploy to the wrong project.

---

## Form field map (Zoho ↔ Website)

Website form field name → Zoho field name (in `api/submit-lead.js`):

| Website HTML `name=` | API reads | → Zoho param | Zoho field label |
|---|---|---|---|
| `fullName` | splits into First/Last | `First Name` + `Last Name` | First / Last Name |
| `email` | `email` | `Email` | Email |
| `company` | `company` | `Company` | Company |
| `role` | `role` → titleVal | `Designation` | Title |
| `companySize` | `companySize` → companySizeVal | `LEADCF1` | Company Size |
| `industry` | `industry` | `Industry` | Industry |
| `hearAboutUs` | `hearAboutUs` → howHeardVal | (AC field 30) | (AC only) |
| `challenge` | `challenge` → solveVal | `Description` | Description |

**Hidden form IDs** (do not change without re-publishing form in Zoho):
- `xnQsjsdp = 16a94b737bb4cc0b770f6b31ecd60a901ca27fa0ca903ed1dce668e83ed84ee6`
- `xmIwtLD = a147a2785f061e935824b204ab91754a91d7155889aaeda1b3e1468a4bec869008f04fe153b617310f07c579b6958e77`

Lead source is hardcoded to `Direct Inbound` for now.

---

## ActiveCampaign integration

- Account: `simplegenius.api-us1.com`
- List 3 = Master Contact List
- Tag 76 = `lets-talk-inbound` (triggers automation 30 → campaign 123 "Let's Talk Follow-up")
- Tag 22 = `newsletter-subscriber`

AC field IDs used:
- 27 = Company
- 28 = Title
- 29 = Company Size
- 30 = How Heard
- 31 = Solve / Challenge
- 9 = Industry
- 3 = Lead Source

---

## Env vars (set in Vercel production)

- `AC_KEY` — ActiveCampaign API key
- `AC_URL` — `https://simplegenius.api-us1.com`
- `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` — Zoho OAuth (not currently used by submit-lead, kept for future REST API path)
- `ZOHO_ACCOUNTS_DOMAIN`, `ZOHO_API_DOMAIN`

---

## Roll-back deploys (in case of emergency)

Known-good production deploys to fall back to:
- `simple-genius-nie8wt2r1` (current — 2026-06-08, full Cluely + all fields working)
- `simple-genius-5tygjmle3` (full restoration — 2026-06-08)
- `simple-genius-qofro7blm` (Cluely + API + all pages)
- `simple-genius-9fbsquic1` (older — has working API but missing newer pages)

Promote a previous deploy:
```bash
npx vercel --token $VERCEL_TOKEN promote <deploy-url> --scope sam-9671s-projects
```

---

## Backup

A full tarball snapshot of this folder is at:
`/home/user/workspace/simplegenius-source-LOCKED-2026-06-08.tar.gz`

To restore from backup:
```bash
cd /home/user/workspace && \
  mv simplegenius-source simplegenius-source-broken-$(date +%s) && \
  tar -xzf simplegenius-source-LOCKED-2026-06-08.tar.gz
```
(You'll need to re-link `.vercel/` after restore — the agent knows how.)
