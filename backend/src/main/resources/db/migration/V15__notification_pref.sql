-- V15 — per-user, per-team notification preferences.
-- 行级模型: (user_id, team_id, pref_key, channel) UNIQUE; enabled = 0/1.
-- pref_key 枚举（应用层校验）: review_result, mention, suite_published, weekly_digest, email_review, email_weekly
-- channel 枚举: inapp, email
CREATE TABLE notification_pref (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    user_id     BIGINT       NOT NULL,
    team_id     BIGINT       NOT NULL,
    pref_key    VARCHAR(40)  NOT NULL,
    channel     VARCHAR(16)  NOT NULL,
    enabled     TINYINT      NOT NULL DEFAULT 1,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_np_user_team_key_chan (user_id, team_id, pref_key, channel),
    KEY idx_np_user_team (user_id, team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
