-- V20 — per-version flat file index for the skill detail "Files" tab.
-- 写入时机：createSkill 与 submitVersion 在版本行落库后调用 SkillVersionFileService.materialize；
-- 历史版本由 listWithLazyBackfill 在首次访问时回填。
CREATE TABLE skill_version_files (
    id           BIGINT        NOT NULL AUTO_INCREMENT,
    version_id   BIGINT        NOT NULL,
    path         VARCHAR(512)  NOT NULL,
    size         BIGINT        NOT NULL DEFAULT 0,
    sort         INT           NOT NULL DEFAULT 0,
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted      TINYINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_skill_version_files_version_sort (version_id, sort),
    CONSTRAINT fk_skill_version_files_version FOREIGN KEY (version_id) REFERENCES skill_versions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Skill 版本 zip 内文件清单';
