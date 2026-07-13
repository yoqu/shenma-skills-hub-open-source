ALTER TABLE teams
    ADD COLUMN logo_url VARCHAR(512) NULL COMMENT '团队 Logo 图片存储 key（相对路径）' AFTER avatar_char;
