package com.skillstack.team.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("invites_code")
public class InviteCode extends BaseEntity {
    private Long teamId;
    private String code;
    private Integer maxUses;
    private Integer used;
    /** ADMIN / MEMBER / VIEWER */
    private String role;
    private LocalDateTime expiresAt;
    private String expiresLabel;
    private Long createdBy;
    /** active / exhausted / expired / revoked */
    private String status;
}
