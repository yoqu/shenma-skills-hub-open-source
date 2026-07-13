-- V16 — personal access token
-- 明文格式: lst_<base62 32>; 库里只存 SHA-256 hex 与前 8 位明文前缀（用于 list & 调试定位）
CREATE TABLE personal_access_token (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    user_id       BIGINT       NOT NULL,
    team_id       BIGINT       NOT NULL,
    name          VARCHAR(64)  NOT NULL,
    kind          VARCHAR(16)  NOT NULL DEFAULT 'personal' COMMENT 'personal | ci',
    token_prefix  VARCHAR(16)  NOT NULL COMMENT '明文前缀 lst_xxxxxxxx，用于列表展示',
    token_hash    CHAR(64)     NOT NULL COMMENT 'SHA-256 hex',
    last_used_at  DATETIME     DEFAULT NULL,
    last_used_ip  VARCHAR(64)  DEFAULT NULL,
    revoked_at    DATETIME     DEFAULT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted       TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_pat_hash (token_hash),
    KEY idx_pat_user_team (user_id, team_id, deleted, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
