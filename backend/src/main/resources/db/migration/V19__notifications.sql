-- V19 — unified in-app notifications inbox.
-- 由 NotificationService 写入；NotificationController 提供 /me 维度的读、未读计数、标记已读。
CREATE TABLE notifications (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    user_id      BIGINT       NOT NULL,
    team_id      BIGINT       DEFAULT NULL,
    type         VARCHAR(48)  NOT NULL,
    category     VARCHAR(32)  NOT NULL,
    title        VARCHAR(160) NOT NULL,
    body         VARCHAR(512) DEFAULT NULL,
    target_url   VARCHAR(256) DEFAULT NULL,
    actor_id     BIGINT       DEFAULT NULL,
    source_type  VARCHAR(32)  DEFAULT NULL,
    source_id    BIGINT       DEFAULT NULL,
    read_at      DATETIME     DEFAULT NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted      TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_notifications_user_read_created (user_id, read_at, created_at),
    KEY idx_notifications_user_team_created (user_id, team_id, created_at),
    KEY idx_notifications_source (source_type, source_id),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_notifications_team FOREIGN KEY (team_id) REFERENCES teams(id),
    CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
