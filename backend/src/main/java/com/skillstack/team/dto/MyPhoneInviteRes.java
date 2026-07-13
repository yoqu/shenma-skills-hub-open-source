package com.skillstack.team.dto;

import lombok.Data;

/** 用户侧查看自己收到的手机邀请（待响应列表）。 */
@Data
public class MyPhoneInviteRes {
    private Long id;
    private Long teamId;
    private String teamName;
    private String teamSlug;
    private String invitedBy;
    private String note;
    private String at;
}
