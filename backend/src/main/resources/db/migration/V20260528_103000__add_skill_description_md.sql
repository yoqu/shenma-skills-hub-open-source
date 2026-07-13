-- Skill 长篇 Markdown 介绍：与 short_desc（一句话）区分。
-- 按 skill 维度存储（不随版本变化）。review-first 流程下先落 reviews，approve 时物化到 skills。
ALTER TABLE skills ADD COLUMN description_md MEDIUMTEXT NULL AFTER short_desc;
ALTER TABLE reviews ADD COLUMN description_md MEDIUMTEXT NULL AFTER short_desc;
