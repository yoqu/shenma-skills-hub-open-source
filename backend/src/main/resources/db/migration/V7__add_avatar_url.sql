ALTER TABLE users
    ADD COLUMN avatar_url VARCHAR(512) NULL COMMENT '头像图片存储 key（相对路径）' AFTER avatar;
