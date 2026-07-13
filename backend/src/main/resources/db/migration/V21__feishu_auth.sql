ALTER TABLE users
    ADD COLUMN feishu_open_id VARCHAR(128) NULL COMMENT '飞书 open_id' AFTER phone,
    ADD COLUMN feishu_union_id VARCHAR(128) NULL COMMENT '飞书 union_id' AFTER feishu_open_id,
    ADD COLUMN feishu_tenant_key VARCHAR(128) NULL COMMENT '飞书 tenant_key' AFTER feishu_union_id,
    ADD COLUMN feishu_avatar_url VARCHAR(512) NULL COMMENT '飞书头像 URL' AFTER avatar_url,
    ADD COLUMN last_login DATETIME NULL COMMENT '最近登录时间' AFTER joined_at;

CREATE UNIQUE INDEX uk_users_feishu_open_tenant ON users (feishu_open_id, feishu_tenant_key);
CREATE INDEX idx_users_feishu_union ON users (feishu_union_id);
