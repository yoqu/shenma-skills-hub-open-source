-- ============================================================
-- V23 — Prompt library + cross-asset extension points
-- ============================================================

CREATE TABLE prompts (
    id                 BIGINT        NOT NULL AUTO_INCREMENT,
    team_id            BIGINT        NOT NULL,
    slug               VARCHAR(96)   NOT NULL,
    name               VARCHAR(128)  NOT NULL,
    short_desc         VARCHAR(512)  DEFAULT NULL,
    cat_code           VARCHAR(32)   NOT NULL,
    visibility         ENUM('PUBLIC','TEAM_PRIVATE') NOT NULL DEFAULT 'TEAM_PRIVATE',
    status             ENUM('APPROVED','UNLISTED') NOT NULL DEFAULT 'APPROVED',
    version            VARCHAR(32)   NOT NULL DEFAULT '0.1.0',
    author_id          BIGINT        NOT NULL,
    score              DECIMAL(3,2)  NOT NULL DEFAULT 0.00,
    stars              INT           NOT NULL DEFAULT 0,
    exports            INT           NOT NULL DEFAULT 0,
    current_version_id BIGINT        DEFAULT NULL,
    published_at       DATETIME      DEFAULT NULL,
    created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted            TINYINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_prompts_team_slug (team_id, slug),
    KEY idx_prompts_team (team_id),
    KEY idx_prompts_author (author_id),
    KEY idx_prompts_status (status),
    KEY idx_prompts_visibility (visibility),
    KEY idx_prompts_cat (cat_code),
    CONSTRAINT fk_prompts_team FOREIGN KEY (team_id) REFERENCES teams(id),
    CONSTRAINT fk_prompts_author FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Prompt 提示词';

CREATE TABLE prompt_versions (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    prompt_id      BIGINT       NOT NULL,
    version        VARCHAR(32)  NOT NULL,
    content_md     MEDIUMTEXT   NOT NULL,
    changelog      TEXT         DEFAULT NULL,
    content_sha256 CHAR(64)     DEFAULT NULL,
    refs_count     INT          NOT NULL DEFAULT 0,
    published_at   DATETIME     DEFAULT NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted        TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_prompt_versions_prompt_version (prompt_id, version),
    KEY idx_prompt_versions_prompt (prompt_id),
    CONSTRAINT fk_prompt_versions_prompt FOREIGN KEY (prompt_id) REFERENCES prompts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Prompt 版本';

ALTER TABLE prompts
    ADD CONSTRAINT fk_prompts_current_version FOREIGN KEY (current_version_id) REFERENCES prompt_versions(id);

CREATE TABLE prompt_refs (
    id                   BIGINT       NOT NULL AUTO_INCREMENT,
    source_prompt_id      BIGINT       NOT NULL,
    source_version_id     BIGINT       NOT NULL,
    referenced_prompt_id  BIGINT       NOT NULL,
    display_label         VARCHAR(128) DEFAULT NULL,
    position              INT          NOT NULL DEFAULT 0,
    created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted               TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_prompt_refs_source_version (source_version_id, position),
    KEY idx_prompt_refs_referenced (referenced_prompt_id),
    CONSTRAINT fk_prompt_refs_source_prompt FOREIGN KEY (source_prompt_id) REFERENCES prompts(id),
    CONSTRAINT fk_prompt_refs_source_version FOREIGN KEY (source_version_id) REFERENCES prompt_versions(id),
    CONSTRAINT fk_prompt_refs_referenced FOREIGN KEY (referenced_prompt_id) REFERENCES prompts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Prompt 引用关系';

CREATE TABLE prompt_tags (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    prompt_id   BIGINT       NOT NULL,
    tag_id      BIGINT       NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_prompt_tags (prompt_id, tag_id),
    KEY idx_prompt_tags_prompt (prompt_id),
    KEY idx_prompt_tags_tag (tag_id),
    CONSTRAINT fk_prompt_tags_prompt FOREIGN KEY (prompt_id) REFERENCES prompts(id),
    CONSTRAINT fk_prompt_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Prompt 标签关联';

ALTER TABLE reviews
    ADD COLUMN target_type VARCHAR(16) NOT NULL DEFAULT 'SKILL' AFTER id,
    ADD COLUMN target_id BIGINT DEFAULT NULL AFTER target_type,
    ADD COLUMN display_slug VARCHAR(96) DEFAULT NULL AFTER target_id,
    ADD COLUMN display_name VARCHAR(128) DEFAULT NULL AFTER display_slug,
    ADD COLUMN payload_json JSON DEFAULT NULL AFTER display_name,
    ADD KEY idx_reviews_target (target_type, target_id);

UPDATE reviews
   SET target_type = 'SKILL',
       target_id = skill_id,
       display_slug = skill_slug,
       display_name = skill_name
 WHERE target_type = 'SKILL';

ALTER TABLE suite_items
    ADD COLUMN item_type VARCHAR(16) NOT NULL DEFAULT 'SKILL' AFTER suite_id,
    ADD COLUMN item_id BIGINT DEFAULT NULL AFTER item_type,
    ADD KEY idx_suite_items_item (item_type, item_id);

UPDATE suite_items SET item_type = 'SKILL', item_id = skill_id WHERE item_id IS NULL;

ALTER TABLE suite_items
    MODIFY COLUMN skill_id BIGINT DEFAULT NULL;

CREATE TABLE asset_reviews (
    id          BIGINT        NOT NULL AUTO_INCREMENT,
    target_type VARCHAR(16)   NOT NULL,
    target_id   BIGINT        NOT NULL,
    user_id     BIGINT        NOT NULL,
    rating      TINYINT       NOT NULL COMMENT '1-5 星',
    body        VARCHAR(2000) NOT NULL,
    version     VARCHAR(32)   NOT NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_asset_reviews_user_target (target_type, target_id, user_id),
    KEY idx_asset_reviews_target (target_type, target_id, created_at),
    CONSTRAINT fk_asset_reviews_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='跨资产用户评分与评论';

INSERT INTO asset_reviews(target_type, target_id, user_id, rating, body, version, created_at, updated_at, deleted)
SELECT 'SKILL', skill_id, user_id, rating, body, version, created_at, updated_at, deleted
  FROM skill_reviews;

CREATE TABLE asset_review_replies (
    id          BIGINT        NOT NULL AUTO_INCREMENT,
    review_id   BIGINT        NOT NULL,
    author_id   BIGINT        NOT NULL,
    body        VARCHAR(2000) NOT NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_asset_review_replies_review (review_id, created_at),
    CONSTRAINT fk_asset_review_replies_review FOREIGN KEY (review_id) REFERENCES asset_reviews(id),
    CONSTRAINT fk_asset_review_replies_author FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='跨资产评论回复';

CREATE TABLE asset_stars (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    target_type VARCHAR(16) NOT NULL,
    target_id   BIGINT      NOT NULL,
    user_id     BIGINT      NOT NULL,
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT     NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_asset_stars_user_target (target_type, target_id, user_id),
    KEY idx_asset_stars_target (target_type, target_id),
    CONSTRAINT fk_asset_stars_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='跨资产收藏';

INSERT INTO asset_stars(target_type, target_id, user_id, created_at, updated_at, deleted)
SELECT 'SKILL', skill_id, user_id, created_at, updated_at, deleted
  FROM skill_stars;
