-- ============================================================
-- V8 — 安全/状态机/数据正确性补丁
-- 对应测试报告 docs/tests/test-audit-report-2026-05-21.md
--   1. reviews.status 追加 CHANGES_REQUESTED 状态        (REV-004 / SUB-002)
--   2. skill_stars 关联表（star/unstar 幂等）              (SKILL-ACT-001/002)
--   3. users.bio / users.avatar_color（注册 step3 字段落库）(REG-008)
--   4. invites_phone.status 追加 cancelled 别名         (TEAM-PHONE-005，可选)
-- ============================================================

-- 1) review 增加 CHANGES_REQUESTED
ALTER TABLE reviews
  MODIFY status ENUM('PENDING_REVIEW','APPROVED','REJECTED','CHANGES_REQUESTED')
  NOT NULL DEFAULT 'PENDING_REVIEW';

-- 2) skill_stars 关联表 — 让 star/unstar 幂等
CREATE TABLE skill_stars (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    user_id     BIGINT      NOT NULL,
    skill_id    BIGINT      NOT NULL,
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT     NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_skill_stars_user_skill (user_id, skill_id),
    KEY idx_skill_stars_skill (skill_id),
    CONSTRAINT fk_skill_stars_user  FOREIGN KEY (user_id)  REFERENCES users(id),
    CONSTRAINT fk_skill_stars_skill FOREIGN KEY (skill_id) REFERENCES skills(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户对 Skill 的收藏（去重幂等）';

-- 3) users 补 bio / avatar_color（注册 step3 已收集但此前没落库）
ALTER TABLE users
    ADD COLUMN bio          VARCHAR(512) DEFAULT NULL COMMENT '个人简介' AFTER avatar_url,
    ADD COLUMN avatar_color VARCHAR(16)  DEFAULT NULL COMMENT '头像背景色 #RRGGBB' AFTER bio;
