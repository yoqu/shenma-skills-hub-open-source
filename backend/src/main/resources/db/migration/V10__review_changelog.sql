-- ============================================================
-- V10 — reviews 追加 changelog 字段（SKILL-VER-001）
-- 用于"发新版本"流程：提交者填写本次版本变更说明。
-- 审核通过时该 changelog 会写入 skill_versions 行。
-- 与 reason 字段语义独立：reason 是审核人反馈，changelog 是提交者声明。
-- ============================================================

ALTER TABLE reviews
    ADD COLUMN changelog VARCHAR(1024) DEFAULT NULL COMMENT '本次提交版本的变更说明（作者填写）' AFTER reason;
