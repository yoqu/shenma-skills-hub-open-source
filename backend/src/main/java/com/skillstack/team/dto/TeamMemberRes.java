package com.skillstack.team.dto;

import lombok.Data;

/** 团队成员列表项 — 对齐前端 TEAM_MEMBERS。 */
@Data
public class TeamMemberRes {
    private Long userId;
    private String handle;
    private String name;
    private String avatar;
    /**
     * 头像图片 URL。SQL 用 {@code COALESCE(u.avatar_url, u.feishu_avatar_url)} 取值，
     * 经 {@code StorageUrlTypeHandler} 自动解析为完整 URL。
     */
    private String avatarUrl;
    /** OWNER / ADMIN / MEMBER / VIEWER */
    private String role;
    private String joined;
    private Integer skills;
    private String lastActive;
}
