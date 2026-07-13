package com.skillstack.team.dto;

import lombok.Data;

/** 当前用户加入的团队 — 对齐前端 MY_TEAMS。 */
@Data
public class MyTeamItem {
    private Long id;
    private String slug;
    private String name;
    private String avatar;
    private String logoUrl;
    private String color;
    /** OWNER / ADMIN / MEMBER / VIEWER（保留枚举大写，前端展示再格式化） */
    private String role;
    private Integer members;
    private Integer unread;
}
