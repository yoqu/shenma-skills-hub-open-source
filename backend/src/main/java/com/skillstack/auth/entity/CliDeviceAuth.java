package com.skillstack.auth.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * CLI 设备授权会话。每次 smskill login --web 都会创建一行。
 * device_code 只发给 CLI；user_code 在浏览器 URL 上暴露并供用户在 web 上确认。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("cli_device_auth")
public class CliDeviceAuth extends BaseEntity {
    private String deviceCode;
    private String userCode;
    /** PENDING / APPROVED / DENIED / EXPIRED / CONSUMED */
    private String status;
    private Long userId;
    private String token;
    private Boolean remember;
    private String userAgent;
    private LocalDateTime expiresAt;
    private LocalDateTime approvedAt;
    private LocalDateTime consumedAt;
    private LocalDateTime lastPolledAt;
}
