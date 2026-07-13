-- V26: 平台超级管理员 / 用户与团队禁用 / 站点设置 / 审计日志
--
-- 设计文档：docs/superpowers/specs/2026-05-25-platform-super-admin-design.md

-- 1) users.platform_role + users.status
ALTER TABLE users
    ADD COLUMN platform_role ENUM('USER','SUPER_ADMIN') NOT NULL DEFAULT 'USER' COMMENT '平台级角色' AFTER password_hash,
    ADD COLUMN status        ENUM('ACTIVE','DISABLED')  NOT NULL DEFAULT 'ACTIVE' COMMENT '账号状态'  AFTER platform_role;

CREATE INDEX idx_users_platform_role ON users(platform_role);
CREATE INDEX idx_users_status        ON users(status);

-- 2) teams.status
ALTER TABLE teams
    ADD COLUMN status ENUM('ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE' COMMENT '团队状态';

CREATE INDEX idx_teams_status ON teams(status);

-- 3) 站点设置（K/V 单例）
CREATE TABLE site_settings (
    setting_key   VARCHAR(64)  NOT NULL,
    setting_value TEXT         NULL,
    value_type    ENUM('STRING','URL','BOOL','JSON') NOT NULL DEFAULT 'STRING',
    updated_by    BIGINT       NULL,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站点级别设置';

INSERT INTO site_settings(setting_key, setting_value, value_type) VALUES
    ('site.name',     'SkillStack', 'STRING'),
    ('site.tagline',  '',           'STRING'),
    ('site.logo_url', '',           'URL'),
    ('site.footer',   '',           'STRING');

-- 4) 审计日志
CREATE TABLE admin_audit_log (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    actor_id     BIGINT       NOT NULL,
    action       VARCHAR(64)  NOT NULL,
    target_type  VARCHAR(32)  NOT NULL,
    target_id    BIGINT       NULL,
    payload_json JSON         NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_admin_audit_actor  (actor_id, created_at),
    KEY idx_admin_audit_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='超级管理员审计日志';

-- 5) bootstrap root 超管账号
-- 密码：admin123（首次登录后请立即修改）
INSERT INTO users (
    handle, name, email, avatar, password_hash, platform_role, status,
    joined_at, created_at, updated_at, deleted
) VALUES (
    'root',
    'Root Admin',
    'root@skillstack.local',
    'R',
    '$2a$10$/kqzSwe8d.F8o8oSDmUw9OI3plvLXZSU9xPmCpNOvpOdFerWxsVPS',
    'SUPER_ADMIN',
    'ACTIVE',
    NOW(), NOW(), NOW(), 0
);
