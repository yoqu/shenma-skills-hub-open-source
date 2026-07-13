-- V14 — team-scoped member profile (display name / bio / email visibility)
-- 1:1 with team_members. 缺失行视为 fallback 到账号级 name + bio.
CREATE TABLE team_member_profile (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    team_id         BIGINT       NOT NULL,
    user_id         BIGINT       NOT NULL,
    display_name    VARCHAR(64)  DEFAULT NULL COMMENT '团队内显示名，NULL 表示用账号级 name',
    bio             VARCHAR(120) DEFAULT NULL COMMENT '团队内简介，限 60 字（DB 留余量）',
    show_email      TINYINT      NOT NULL DEFAULT 0 COMMENT '允许同团队成员查看邮箱（Admin 永远可见）',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_tmp_team_user (team_id, user_id),
    KEY idx_tmp_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
