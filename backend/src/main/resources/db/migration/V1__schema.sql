-- ============================================================
-- SkillStack · V1 schema
-- charset: utf8mb4 / collation: utf8mb4_0900_ai_ci
-- 所有表均含 id BIGINT AUTO_INCREMENT, created_at, updated_at, deleted TINYINT
-- ============================================================

SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- categories: 分类（静态字典，但仍按表存）
-- ------------------------------------------------------------
CREATE TABLE categories (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    code        VARCHAR(32)  NOT NULL COMMENT '分类编码 dev/data/...',
    name        VARCHAR(64)  NOT NULL,
    count       INT          NOT NULL DEFAULT 0 COMMENT '冗余计数（前端展示用）',
    sort        INT          NOT NULL DEFAULT 0,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_categories_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='分类字典';

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE users (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    handle          VARCHAR(64)   NOT NULL COMMENT '登录用户名',
    name            VARCHAR(64)   NOT NULL,
    email           VARCHAR(128)  DEFAULT NULL,
    phone           VARCHAR(32)   DEFAULT NULL,
    avatar          VARCHAR(8)    DEFAULT NULL COMMENT '汉字 / emoji / 字母',
    password_hash   VARCHAR(255)  NOT NULL,
    joined_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_handle (handle),
    UNIQUE KEY uk_users_email (email),
    KEY idx_users_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户';

-- ------------------------------------------------------------
-- teams
-- ------------------------------------------------------------
CREATE TABLE teams (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    slug            VARCHAR(64)   NOT NULL,
    name            VARCHAR(128)  NOT NULL,
    description     VARCHAR(512)  DEFAULT NULL,
    avatar_char     VARCHAR(8)    DEFAULT NULL,
    color           VARCHAR(16)   DEFAULT '#4F46E5',
    members_count   INT           NOT NULL DEFAULT 0,
    public_skills   INT           NOT NULL DEFAULT 0,
    private_skills  INT           NOT NULL DEFAULT 0,
    suites_count    INT           NOT NULL DEFAULT 0,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_teams_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='团队';

-- ------------------------------------------------------------
-- team_members: 团队成员（角色 + 加入时间 + 最近活跃）
-- ------------------------------------------------------------
CREATE TABLE team_members (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    team_id         BIGINT        NOT NULL,
    user_id         BIGINT        NOT NULL,
    role            ENUM('OWNER','ADMIN','MEMBER','VIEWER') NOT NULL DEFAULT 'MEMBER',
    skills_count    INT           NOT NULL DEFAULT 0 COMMENT '该成员在团队内贡献的 skill 数（冗余）',
    joined_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_active_at  DATETIME      DEFAULT NULL,
    last_active_label VARCHAR(32) DEFAULT NULL COMMENT '原型展示用相对描述（如 "刚刚"）',
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_team_members_team_user (team_id, user_id),
    KEY idx_team_members_team (team_id),
    KEY idx_team_members_user (user_id),
    CONSTRAINT fk_team_members_team FOREIGN KEY (team_id) REFERENCES teams(id),
    CONSTRAINT fk_team_members_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='团队成员';

-- ------------------------------------------------------------
-- skills
-- ------------------------------------------------------------
CREATE TABLE skills (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    slug            VARCHAR(96)   NOT NULL,
    name            VARCHAR(128)  NOT NULL,
    short_desc      VARCHAR(512)  DEFAULT NULL,
    cat_code        VARCHAR(32)   NOT NULL COMMENT '关联 categories.code',
    icon            VARCHAR(8)    DEFAULT NULL,
    version         VARCHAR(32)   NOT NULL DEFAULT '0.1.0',
    visibility      ENUM('PUBLIC','TEAM_PRIVATE') NOT NULL DEFAULT 'TEAM_PRIVATE',
    status          ENUM('DRAFT','PENDING','APPROVED','REJECTED','UNLISTED') NOT NULL DEFAULT 'DRAFT',
    author_id       BIGINT        NOT NULL,
    team_id         BIGINT        NOT NULL,
    installs        INT           NOT NULL DEFAULT 0,
    stars           INT           NOT NULL DEFAULT 0,
    score           DECIMAL(3,2)  NOT NULL DEFAULT 0.00,
    safety          ENUM('pass','warn','fail') NOT NULL DEFAULT 'pass',
    eval_score      INT           NOT NULL DEFAULT 0,
    langs           JSON          DEFAULT NULL COMMENT '["TS","Py",...]',
    published_at    DATETIME      DEFAULT NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_skills_slug (slug),
    KEY idx_skills_team (team_id),
    KEY idx_skills_author (author_id),
    KEY idx_skills_status (status),
    KEY idx_skills_visibility (visibility),
    KEY idx_skills_cat (cat_code),
    CONSTRAINT fk_skills_author FOREIGN KEY (author_id) REFERENCES users(id),
    CONSTRAINT fk_skills_team   FOREIGN KEY (team_id) REFERENCES teams(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Skill';

-- ------------------------------------------------------------
-- skill_versions: 版本历史
-- ------------------------------------------------------------
CREATE TABLE skill_versions (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    skill_id        BIGINT        NOT NULL,
    version         VARCHAR(32)   NOT NULL,
    changelog       TEXT          DEFAULT NULL,
    files_count     INT           NOT NULL DEFAULT 0,
    safety          ENUM('pass','warn','fail') NOT NULL DEFAULT 'pass',
    eval_score      INT           NOT NULL DEFAULT 0,
    published_at    DATETIME      DEFAULT NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_skill_versions_skill_version (skill_id, version),
    KEY idx_skill_versions_skill (skill_id),
    CONSTRAINT fk_skill_versions_skill FOREIGN KEY (skill_id) REFERENCES skills(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Skill 版本';

-- ------------------------------------------------------------
-- tags + skill_tags
-- ------------------------------------------------------------
CREATE TABLE tags (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    name        VARCHAR(64)  NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='标签';

CREATE TABLE skill_tags (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    skill_id    BIGINT       NOT NULL,
    tag_id      BIGINT       NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_skill_tags (skill_id, tag_id),
    KEY idx_skill_tags_skill (skill_id),
    KEY idx_skill_tags_tag   (tag_id),
    CONSTRAINT fk_skill_tags_skill FOREIGN KEY (skill_id) REFERENCES skills(id),
    CONSTRAINT fk_skill_tags_tag   FOREIGN KEY (tag_id)   REFERENCES tags(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Skill 标签关联';

-- ------------------------------------------------------------
-- suites + suite_items
-- ------------------------------------------------------------
CREATE TABLE suites (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    slug            VARCHAR(96)   NOT NULL,
    name            VARCHAR(128)  NOT NULL,
    description     VARCHAR(512)  DEFAULT NULL,
    team_id         BIGINT        NOT NULL,
    visibility      ENUM('PUBLIC','TEAM_PRIVATE') NOT NULL DEFAULT 'TEAM_PRIVATE',
    installs        INT           NOT NULL DEFAULT 0,
    skills_count    INT           NOT NULL DEFAULT 0 COMMENT '冗余',
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_suites_team_slug (team_id, slug),
    KEY idx_suites_team (team_id),
    CONSTRAINT fk_suites_team FOREIGN KEY (team_id) REFERENCES teams(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='套件';

CREATE TABLE suite_items (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    suite_id    BIGINT       NOT NULL,
    skill_id    BIGINT       NOT NULL,
    position    INT          NOT NULL DEFAULT 0,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_suite_items (suite_id, skill_id),
    KEY idx_suite_items_suite (suite_id),
    KEY idx_suite_items_skill (skill_id),
    CONSTRAINT fk_suite_items_suite FOREIGN KEY (suite_id) REFERENCES suites(id),
    CONSTRAINT fk_suite_items_skill FOREIGN KEY (skill_id) REFERENCES skills(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='套件成员';

-- ------------------------------------------------------------
-- reviews: 审核记录
-- ------------------------------------------------------------
CREATE TABLE reviews (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    code            VARCHAR(32)   NOT NULL COMMENT '业务编号 r-1042',
    skill_id        BIGINT        DEFAULT NULL COMMENT '关联 skill（已建档）',
    skill_slug      VARCHAR(96)   NOT NULL COMMENT '冗余 slug 便于待建档审核',
    skill_name      VARCHAR(128)  NOT NULL,
    short_desc      VARCHAR(512)  DEFAULT NULL,
    team_id         BIGINT        NOT NULL,
    submitter_id    BIGINT        NOT NULL,
    visibility      ENUM('PUBLIC','TEAM_PRIVATE') NOT NULL DEFAULT 'TEAM_PRIVATE',
    files_count     INT           NOT NULL DEFAULT 0,
    version         VARCHAR(32)   DEFAULT NULL,
    safety          ENUM('pass','warn','fail') NOT NULL DEFAULT 'pass',
    eval_score      INT           NOT NULL DEFAULT 0,
    status          ENUM('PENDING_REVIEW','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW',
    reason          VARCHAR(1024) DEFAULT NULL,
    reviewer_id     BIGINT        DEFAULT NULL,
    submitted_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at      DATETIME      DEFAULT NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_reviews_code (code),
    KEY idx_reviews_team (team_id),
    KEY idx_reviews_submitter (submitter_id),
    KEY idx_reviews_skill (skill_id),
    KEY idx_reviews_status (status),
    CONSTRAINT fk_reviews_team      FOREIGN KEY (team_id)      REFERENCES teams(id),
    CONSTRAINT fk_reviews_submitter FOREIGN KEY (submitter_id) REFERENCES users(id),
    CONSTRAINT fk_reviews_reviewer  FOREIGN KEY (reviewer_id)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='审核';

-- ------------------------------------------------------------
-- invites_code: 邀请码
-- ------------------------------------------------------------
CREATE TABLE invites_code (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    team_id         BIGINT        NOT NULL,
    code            VARCHAR(64)   NOT NULL,
    max_uses        INT           NOT NULL DEFAULT 10,
    used            INT           NOT NULL DEFAULT 0,
    role            ENUM('ADMIN','MEMBER','VIEWER') NOT NULL DEFAULT 'MEMBER',
    expires_at      DATETIME      DEFAULT NULL,
    expires_label   VARCHAR(32)   DEFAULT NULL COMMENT '原型展示用 "14 天" / "已用完"',
    created_by      BIGINT        NOT NULL,
    status          ENUM('active','exhausted','expired','revoked') NOT NULL DEFAULT 'active',
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_invites_code_code (code),
    KEY idx_invites_code_team (team_id),
    KEY idx_invites_code_creator (created_by),
    CONSTRAINT fk_invites_code_team    FOREIGN KEY (team_id)    REFERENCES teams(id),
    CONSTRAINT fk_invites_code_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='邀请码';

-- ------------------------------------------------------------
-- invites_phone: 手机邀请
-- ------------------------------------------------------------
CREATE TABLE invites_phone (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    team_id         BIGINT        NOT NULL,
    phone_masked    VARCHAR(32)   NOT NULL,
    phone_raw       VARCHAR(32)   DEFAULT NULL,
    invited_by      BIGINT        NOT NULL,
    note            VARCHAR(255)  DEFAULT NULL,
    status          ENUM('pending','accepted','declined','expired') NOT NULL DEFAULT 'pending',
    at_label        VARCHAR(32)   DEFAULT NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_invites_phone_team (team_id),
    KEY idx_invites_phone_inviter (invited_by),
    CONSTRAINT fk_invites_phone_team    FOREIGN KEY (team_id)    REFERENCES teams(id),
    CONSTRAINT fk_invites_phone_inviter FOREIGN KEY (invited_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='手机邀请';

-- ------------------------------------------------------------
-- activity: 活动流
-- ------------------------------------------------------------
CREATE TABLE activity (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    team_id         BIGINT        NOT NULL,
    actor_id        BIGINT        NOT NULL,
    kind            VARCHAR(32)   NOT NULL COMMENT 'approve|submit|invite|release|unlist|join|suite|...',
    target          VARCHAR(255)  DEFAULT NULL COMMENT '展示用目标文本（slug 或自然语言）',
    target_skill_id BIGINT        DEFAULT NULL,
    target_suite_id BIGINT        DEFAULT NULL,
    extra           VARCHAR(255)  DEFAULT NULL,
    when_label      VARCHAR(32)   DEFAULT NULL COMMENT '展示用相对时间',
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_activity_team (team_id),
    KEY idx_activity_actor (actor_id),
    KEY idx_activity_kind (kind),
    KEY idx_activity_created (created_at),
    CONSTRAINT fk_activity_team  FOREIGN KEY (team_id)  REFERENCES teams(id),
    CONSTRAINT fk_activity_actor FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='活动流';

-- ------------------------------------------------------------
-- user_team_unread: header 团队切换器的未读计数
-- ------------------------------------------------------------
CREATE TABLE user_team_unread (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    user_id     BIGINT       NOT NULL,
    team_id     BIGINT       NOT NULL,
    unread      INT          NOT NULL DEFAULT 0,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_team_unread (user_id, team_id),
    KEY idx_user_team_unread_user (user_id),
    CONSTRAINT fk_user_team_unread_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_user_team_unread_team FOREIGN KEY (team_id) REFERENCES teams(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户在团队的未读计数';
