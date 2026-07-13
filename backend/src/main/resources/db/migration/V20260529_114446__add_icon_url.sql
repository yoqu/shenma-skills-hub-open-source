-- 自定义上传图标：DB 存 storage key（raw），对外经 StorageUrlResolver 返回完整 URL。
-- 与现有 skills.icon（字符兜底）共存；prompts 之前没有图标列，这里只加 icon_url。
-- reviews.icon_url 用于审核期暂存图标 key，approve 时复制到 skills/prompts。

ALTER TABLE skills
    ADD COLUMN icon_url VARCHAR(512) DEFAULT NULL COMMENT '自定义图标 storage key（对外解析为完整 URL）' AFTER icon;

ALTER TABLE prompts
    ADD COLUMN icon_url VARCHAR(512) DEFAULT NULL COMMENT '自定义图标 storage key（对外解析为完整 URL）' AFTER cat_code;

ALTER TABLE reviews
    ADD COLUMN icon_url VARCHAR(512) DEFAULT NULL COMMENT '审核期自定义图标 storage key，approve 时复制到目标资产' AFTER icon;
