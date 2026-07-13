-- ============================================================
-- V11 — 审核评论持久化（REV-006）
-- 让作者与 reviewer 在审核详情里能持续对话，替代之前的本地 mock。
-- ============================================================

CREATE TABLE review_comments (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    review_id   BIGINT       NOT NULL,
    author_id   BIGINT       NOT NULL,
    /** mine (作者) / review (审核人) — 由 service 根据角色判定后写入 */
    kind        ENUM('mine', 'review') NOT NULL DEFAULT 'mine',
    body        VARCHAR(2000) NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_review_comments_review (review_id, created_at),
    KEY idx_review_comments_author (author_id),
    CONSTRAINT fk_review_comments_review FOREIGN KEY (review_id) REFERENCES reviews(id),
    CONSTRAINT fk_review_comments_author FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='审核记录上的对话评论';
