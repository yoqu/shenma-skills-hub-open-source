-- Review-First Submission (2026-05-22)
--
-- reviews 表承载提交事务的完整生命周期；
-- 把 skills 表中 DRAFT/PENDING_REVIEW/REJECTED/CHANGES_REQUESTED 的行下嫁到 reviews，
-- 让 skills 表只装 APPROVED/UNLISTED 的已发布资产。
--
-- 注意：spec 中将此 migration 命名为 V15，但本仓库 V15/V16 已被占用 (notification_pref / pat)，
-- 因此延后到 V17。
--
-- 1) reviews 扩列
ALTER TABLE reviews
  ADD COLUMN cat_code   VARCHAR(64)   NULL AFTER short_desc,
  ADD COLUMN icon       VARCHAR(64)   NULL AFTER cat_code,
  ADD COLUMN langs_json VARCHAR(256)  NULL AFTER icon,
  ADD COLUMN tags_json  VARCHAR(1024) NULL AFTER langs_json,
  ADD COLUMN kind       VARCHAR(16)   NOT NULL DEFAULT 'CREATE' AFTER tags_json;

-- 1b) status 枚举扩展 DRAFT；submitted_at 允许 NULL（草稿未提交）
ALTER TABLE reviews
  MODIFY COLUMN status enum('DRAFT','PENDING_REVIEW','APPROVED','REJECTED','CHANGES_REQUESTED','WITHDRAWN')
    NOT NULL DEFAULT 'PENDING_REVIEW',
  MODIFY COLUMN submitted_at DATETIME NULL DEFAULT NULL;

-- 2) 回填 kind
UPDATE reviews r
JOIN skills s ON s.id = r.skill_id
SET r.kind = CASE
  WHEN s.status IN ('APPROVED','UNLISTED') AND r.version <> s.version THEN 'VERSION_BUMP'
  ELSE 'CREATE'
END;

-- 3a) 已存在的 open review：把 cat_code/icon/langs/tags_json 快照到 reviews
UPDATE reviews r
JOIN skills s ON s.id = r.skill_id
LEFT JOIN (
  SELECT st.skill_id, JSON_ARRAYAGG(t.name) AS tags
  FROM skill_tags st JOIN tags t ON t.id = st.tag_id
  GROUP BY st.skill_id
) tg ON tg.skill_id = s.id
SET r.cat_code = s.cat_code,
    r.icon = s.icon,
    r.langs_json = s.langs,
    r.tags_json = COALESCE(tg.tags, JSON_ARRAY())
WHERE s.status IN ('DRAFT','PENDING_REVIEW','REJECTED','CHANGES_REQUESTED')
  AND r.kind = 'CREATE';

-- 3b) skills.DRAFT 但没有 review 行：为每个新建一条 reviews.kind='CREATE'
INSERT INTO reviews (code, skill_id, skill_slug, skill_name, short_desc,
                     team_id, submitter_id, visibility, files_count, version,
                     safety, eval_score, status, submitted_at,
                     cat_code, icon, langs_json, tags_json, kind, created_at, updated_at)
SELECT CONCAT('r-mig-', s.id),
       NULL, s.slug, s.name, s.short_desc,
       s.team_id, s.author_id, s.visibility, 0, s.version,
       s.safety, s.eval_score, 'DRAFT', NOW(),
       s.cat_code, s.icon, s.langs,
       COALESCE((SELECT JSON_ARRAYAGG(t.name)
                 FROM skill_tags st JOIN tags t ON t.id = st.tag_id
                 WHERE st.skill_id = s.id), JSON_ARRAY()),
       'CREATE', NOW(), NOW()
FROM skills s
WHERE s.status = 'DRAFT'
  AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.skill_id = s.id);

-- 4) 清理 skill_tags：被下嫁的 skills 行的 tag 关联失效（tags_json 已快照）
DELETE st FROM skill_tags st
JOIN skills s ON s.id = st.skill_id
WHERE s.status IN ('DRAFT','PENDING_REVIEW','REJECTED','CHANGES_REQUESTED');

-- 5) 把被下嫁的 reviews 行的 skill_id 置空（kind='CREATE' 的）
UPDATE reviews r
JOIN skills s ON s.id = r.skill_id
SET r.skill_id = NULL
WHERE s.status IN ('DRAFT','PENDING_REVIEW','REJECTED','CHANGES_REQUESTED')
  AND r.kind = 'CREATE';

-- 6) 软删被下嫁的 skills 行（放最后，前置失败可重跑）
UPDATE skills SET deleted = 1
WHERE status IN ('DRAFT','PENDING_REVIEW','REJECTED','CHANGES_REQUESTED');
