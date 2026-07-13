-- ============================================================
-- V22 — skill 用户评分 / 评论 + 作者回复
-- ============================================================
-- 1) skill_reviews：每个用户对每个 skill 至多一条评分+评论；upsert 写入。
-- 2) skill_review_replies：仅 skill 作者可对评论追加回复，行级追加。
-- 3) 写入后由 service 重新聚合 skills.score = AVG(rating)。
-- ============================================================

CREATE TABLE skill_reviews (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    skill_id    BIGINT       NOT NULL,
    user_id     BIGINT       NOT NULL,
    rating      TINYINT      NOT NULL COMMENT '1-5 星',
    body        VARCHAR(2000) NOT NULL,
    version     VARCHAR(32)  NOT NULL COMMENT '评价时的 skill 版本号',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_skill_reviews_user_skill (user_id, skill_id),
    KEY idx_skill_reviews_skill (skill_id, created_at),
    CONSTRAINT fk_skill_reviews_skill FOREIGN KEY (skill_id) REFERENCES skills(id),
    CONSTRAINT fk_skill_reviews_user  FOREIGN KEY (user_id)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Skill 用户评分与评论';

CREATE TABLE skill_review_replies (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    review_id   BIGINT       NOT NULL,
    author_id   BIGINT       NOT NULL COMMENT '回复者；当前仅 skill 作者可写',
    body        VARCHAR(2000) NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_skill_review_replies_review (review_id, created_at),
    CONSTRAINT fk_skill_review_replies_review FOREIGN KEY (review_id) REFERENCES skill_reviews(id),
    CONSTRAINT fk_skill_review_replies_author FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Skill 作者对评论的回复';
