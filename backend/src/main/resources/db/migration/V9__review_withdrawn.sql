-- ============================================================
-- V9 — 审核流程追加 WITHDRAWN 状态（REV-005）
-- 用于提交者主动撤回 PENDING_REVIEW 状态的审核记录；
-- Skill 联动回到 DRAFT，作者可重新编辑后再次提交。
-- ============================================================

ALTER TABLE reviews
  MODIFY status ENUM('PENDING_REVIEW','APPROVED','REJECTED','CHANGES_REQUESTED','WITHDRAWN')
  NOT NULL DEFAULT 'PENDING_REVIEW';
