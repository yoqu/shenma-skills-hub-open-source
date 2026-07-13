package com.skillstack.team.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TeamMemberProfileRes {
    /** 团队内显示名（fallback 到账号 name） */
    private String displayName;
    /** 团队内简介（fallback 到账号 bio） */
    private String bio;
    /** 允许同团队成员查看邮箱 */
    private Boolean showEmail;
    /** 账号级 email，仅本人或 Admin 看；普通成员永远 null */
    private String email;
    /** 头像 URL（账号级） */
    private String avatarUrl;
    /** 账号 handle */
    private String handle;
}
