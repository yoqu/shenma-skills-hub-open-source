-- Replace user_skills.type with source so desktop can distinguish
-- personal, team, and public Skill origins.
-- Development stage: old user skill data is discarded instead of migrated.
TRUNCATE TABLE user_skills;

ALTER TABLE user_skills
    ADD COLUMN source ENUM('PERSONAL','TEAM','PUBLIC') NOT NULL DEFAULT 'PERSONAL'
        COMMENT '来源：PERSONAL=个人导入，TEAM=团队 Skill，PUBLIC=公开 Skill'
        AFTER user_id;

ALTER TABLE user_skills
    DROP INDEX uk_user_skills_user_type_slug,
    DROP INDEX idx_user_skills_user_type_skill,
    DROP INDEX idx_user_skills_user_type,
    ADD UNIQUE KEY uk_user_skills_user_source_slug (user_id, source, slug),
    ADD KEY idx_user_skills_user_skill (user_id, skill_id);

ALTER TABLE user_skills
    DROP COLUMN type;
