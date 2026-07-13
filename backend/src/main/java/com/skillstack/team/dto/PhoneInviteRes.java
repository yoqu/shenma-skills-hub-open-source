package com.skillstack.team.dto;

import lombok.Data;

/** 手机邀请列表项 — 对齐前端 PHONE_INVITES。 */
@Data
public class PhoneInviteRes {
    private Long id;
    private String phone;
    private String invitedBy;
    private String at;
    private String note;
    /** pending / accepted / declined / expired */
    private String status;
}
