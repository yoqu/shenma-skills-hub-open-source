-- V24: 扩展 skills.status 枚举，新增 ARCHIVED 用于超级管理员强制下架
-- 设计文档：docs/superpowers/specs/2026-05-25-platform-super-admin-design.md §5.4
ALTER TABLE skills
  MODIFY status ENUM('DRAFT','PENDING','PENDING_REVIEW','APPROVED','REJECTED','UNLISTED','ARCHIVED')
  NOT NULL DEFAULT 'DRAFT';
