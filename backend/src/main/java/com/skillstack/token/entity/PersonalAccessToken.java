package com.skillstack.token.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("personal_access_token")
public class PersonalAccessToken extends BaseEntity {
    private Long userId;
    private Long teamId;
    private String name;
    private String kind;
    private String tokenPrefix;
    private String tokenHash;
    private LocalDateTime lastUsedAt;
    private String lastUsedIp;
    private LocalDateTime revokedAt;
}
