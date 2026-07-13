-- CLI device authorization flow (similar to GitHub CLI / Vercel CLI).
-- 创建一次性授权会话：CLI 持有 device_code 轮询；web 端登录用户拿 user_code 审批。
CREATE TABLE IF NOT EXISTS cli_device_auth (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    device_code VARCHAR(96) NOT NULL COMMENT 'CLI 持有的秘密码，用于轮询拿 token',
    user_code VARCHAR(16) NOT NULL COMMENT '人眼可读短码，URL 上暴露给 web',
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/APPROVED/DENIED/EXPIRED/CONSUMED',
    user_id BIGINT NULL COMMENT '审批通过的用户 id',
    token TEXT NULL COMMENT '审批通过后写入的 JWT，被 CLI 取走后清空',
    remember TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否签发 7d 长 token',
    user_agent VARCHAR(255) NULL COMMENT 'CLI 自报标识，便于审计',
    expires_at DATETIME NOT NULL,
    approved_at DATETIME NULL,
    consumed_at DATETIME NULL,
    last_polled_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uk_cli_device_code (device_code),
    UNIQUE KEY uk_cli_user_code (user_code),
    KEY idx_cli_expires (expires_at),
    KEY idx_cli_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CLI 设备授权流程';
