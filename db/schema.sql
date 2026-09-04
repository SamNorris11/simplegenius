-- Simple Genius — /try Competitive AI Scan pipeline
-- Run this once in the Neon SQL editor (Vercel Storage -> neon-amber-flask -> Open in Neon -> SQL editor).
-- Safe to re-run: every statement is idempotent.

CREATE TABLE IF NOT EXISTS brief_jobs (
  id                   UUID PRIMARY KEY,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- prospect / submitter
  first_name           TEXT NOT NULL,
  last_name            TEXT NOT NULL,
  email                TEXT NOT NULL,
  role                 TEXT,

  -- target company (from the form)
  company              TEXT NOT NULL,
  website              TEXT NOT NULL,
  socials              TEXT,

  -- competitors (from the form)
  competitor1_name     TEXT NOT NULL,
  competitor1_site     TEXT NOT NULL,
  competitor2_name     TEXT NOT NULL,
  competitor2_site     TEXT NOT NULL,

  -- attribution
  utm_source           TEXT,
  utm_medium           TEXT,
  utm_campaign         TEXT,
  page_url             TEXT,
  referrer             TEXT,

  -- pipeline status machine
  -- SUBMITTED -> RESEARCHING -> SYNTHESIZING -> INSIGHTS -> FACT_CHECKING -> GENERATING_PDF -> DELIVERED
  -- or -> NEEDS_REVIEW (failed QC gate) / FAILED (hard error, exhausted retries)
  status               TEXT NOT NULL DEFAULT 'SUBMITTED',
  attempts             INT NOT NULL DEFAULT 0,
  last_error           TEXT,

  -- stage outputs (structured JSON per the master spec's content schema)
  research_target      JSONB,
  research_competitor1 JSONB,
  research_competitor2 JSONB,
  synthesis             JSONB,   -- comparison categories (<=5) + 4 business findings + 3+3 competitive findings
  insights              JSONB,   -- 3 strategic insights: what we see / why it matters / what to do / evidence
  qc_result              JSONB,  -- pass/fail + notes against the QC gate checklist

  -- delivery
  pdf_url               TEXT,
  delivered_at          TIMESTAMPTZ,
  zoho_pdf_sync_status  TEXT NOT NULL DEFAULT 'PENDING',
  zoho_pdf_sync_attempts INT NOT NULL DEFAULT 0,
  zoho_pdf_sync_error   TEXT,
  zoho_pdf_synced_at    TIMESTAMPTZ
);

ALTER TABLE brief_jobs ADD COLUMN IF NOT EXISTS zoho_pdf_sync_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE brief_jobs ADD COLUMN IF NOT EXISTS zoho_pdf_sync_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE brief_jobs ADD COLUMN IF NOT EXISTS zoho_pdf_sync_error TEXT;
ALTER TABLE brief_jobs ADD COLUMN IF NOT EXISTS zoho_pdf_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_brief_jobs_status ON brief_jobs (status);
CREATE INDEX IF NOT EXISTS idx_brief_jobs_created_at ON brief_jobs (created_at);
CREATE INDEX IF NOT EXISTS idx_brief_jobs_email ON brief_jobs (email);

-- Automatic client-side diagnostics from the /report PDF viewer. Populated
-- by api/report-viewer-error.js whenever the in-page renderer fails in a
-- real visitor's browser, so we can see the exact error without needing
-- the visitor to send a screenshot.
CREATE TABLE IF NOT EXISTS viewer_errors (
  id             SERIAL PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_url        TEXT,
  user_agent     TEXT,
  error_name     TEXT,
  error_message  TEXT,
  error_stack    TEXT,
  stage          TEXT
);

CREATE INDEX IF NOT EXISTS idx_viewer_errors_created_at ON viewer_errors (created_at);
