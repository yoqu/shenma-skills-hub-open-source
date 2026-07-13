package com.skillstack.team.dto;

import lombok.Data;

/** 邀请码列表项 — 对齐前端 INVITES。 */
@Data
public class InviteCodeRes {
    private Long id;
    private String code;
    private Integer uses;
    private Integer max;
    private String expiresIn;
    /** ADMIN / MEMBER / VIEWER */
    private String role;
    /** active / exhausted / expired / revoked */
    private String status;
    private String createdBy;
    private String createdAt;
}
