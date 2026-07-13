package com.skillstack.team.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

/** 团队设置表单：名称 / 简介 / avatar / color / 审核模式（保留扩展占位）。 */
@Data
public class TeamSettingsReq {
    @Size(max = 128)
    private String name;

    @Size(max = 512)
    private String description;

    @Size(max = 8)
    private String avatarChar;

    @Size(max = 16)
    private String color;

    /** REVIEW_REQUIRED / DIRECT_PUBLISH，持久化到 teams.review_mode */
    private String reviewMode;

    /** 公开主页开关，占位 */
    private Boolean publicHome;
}
