-- User Skill cloud list for desktop client v1.
-- Stores both personal imported Skills and plaza/recommended subscribed Skills.
CREATE TABLE user_skills (
    id             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
    user_id        BIGINT       NOT NULL DEFAULT 0 COMMENT '用户 ID',
    type           ENUM('PERSONAL','SUBSCRIBED') NOT NULL DEFAULT 'PERSONAL' COMMENT '类型：PERSONAL=个人导入，SUBSCRIBED=广场添加',

    skill_id       BIGINT       NOT NULL DEFAULT 0 COMMENT '关联 skills.id；SUBSCRIBED 必填；PERSONAL 发布到广场后回填；0 表示未关联公开 Skill',
    review_id      BIGINT       NOT NULL DEFAULT 0 COMMENT '关联发布审核 reviews.id；个人 Skill 提交发布审核后记录；0 表示无审核单',

    slug           VARCHAR(96)  NOT NULL DEFAULT '' COMMENT 'Skill slug，沿用 skills.slug',
    name           VARCHAR(128) NOT NULL DEFAULT '' COMMENT 'Skill 名称，沿用 skills.name',
    short_desc     VARCHAR(512) NOT NULL DEFAULT '' COMMENT '一句话描述，沿用 skills.short_desc',
    cat_code       VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '分类编码，沿用 skills.cat_code',
    icon           VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '图标，沿用 reviews.icon，预留图标 key/URL',
    version        VARCHAR(32)  NOT NULL DEFAULT '0.1.0' COMMENT '当前云端版本，沿用 skills.version / skill_versions.version',

    zip_url        VARCHAR(512) NOT NULL DEFAULT '' COMMENT '个人导入 Skill 的 zip storage key，沿用 reviews.zip_url / skill_versions.zip_url',
    files_count    INT          NOT NULL DEFAULT 0 COMMENT 'zip 内文件数量，沿用 reviews.files_count / skill_versions.files_count',
    safety         ENUM('pass','warn','fail') NOT NULL DEFAULT 'pass' COMMENT '安全检查结果，沿用 skills.safety',
    eval_score     INT          NOT NULL DEFAULT 0 COMMENT '评测分数，沿用 skills.eval_score',
    langs          JSON         NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '语言数组 JSON，沿用 skills.langs',

    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除标记：0=未删除，1=已删除',

    PRIMARY KEY (id),
    UNIQUE KEY uk_user_skills_user_type_slug (user_id, type, slug),
    KEY idx_user_skills_user_type_skill (user_id, type, skill_id),
    KEY idx_user_skills_user_type (user_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户 Skill 清单：个人导入与广场添加';
