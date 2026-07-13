package com.skillstack.auth.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("users")
public class User extends BaseEntity {
    private String handle;
    private String name;
    private String email;
    private String phone;
    private String feishuOpenId;
    private String feishuUnionId;
    private String feishuTenantKey;
    private String avatar;
    private String avatarUrl;
    private String feishuAvatarUrl;
    private String bio;
    private String avatarColor;
    private String passwordHash;
    /** USER / SUPER_ADMIN */
    private String platformRole;
    /** ACTIVE / DISABLED */
    private String status;
    private LocalDateTime joinedAt;
    private LocalDateTime lastLogin;
}
