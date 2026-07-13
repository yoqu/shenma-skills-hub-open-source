-- Persist team-level review mode (REVIEW_REQUIRED / DIRECT_PUBLISH) and the
-- "show team home publicly" toggle. Both already accepted by TeamSettingsReq
-- but previously discarded.
ALTER TABLE teams
  ADD COLUMN review_mode  VARCHAR(32)  NOT NULL DEFAULT 'REVIEW_REQUIRED' AFTER suites_count,
  ADD COLUMN public_home  TINYINT(1)   NOT NULL DEFAULT 1                AFTER review_mode;
