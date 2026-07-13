package com.skillstack.auth.oauth.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("user_oauth_identities")
public class UserOAuthIdentity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String provider;
    private String providerUserId;
    private String unionId;
    private String username;
    private String email;
    private String avatarUrl;
    private String rawPayload;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
