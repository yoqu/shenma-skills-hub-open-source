package com.skillstack.skill.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Skill 详情，字段对齐 screen-detail-main.jsx + screen-detail-sidebar.jsx。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillDetail {
    private Long id;
    private String slug;
    private String name;
    private String shortDesc;
    private String descriptionMd;
    private String cat;
    private String catName;
    private String icon;
    /** 自定义上传图标完整 URL（无则为 null） */
    private String iconUrl;
    private String version;
    private String visibility;
    private String status;

    private Integer installs;
    private Integer stars;
    private BigDecimal score;
    private String safety;
    private Integer evalScore;
    /** YYYY-MM-DD */
    private String updated;
    /** YYYY-MM-DD HH:mm:ss */
    private String publishedAt;

    private List<String> tags;
    private List<String> langs;

    private SkillCard.AuthorRef author;
    private TeamRef team;

    /** 文件数 / 许可证（占位字段，给详情侧栏渲染用） */
    private Integer filesCount;
    private String license;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeamRef {
        private Long id;
        private String slug;
        private String name;
        private String avatar;
        private String color;
        private Integer members;
        private Integer publicSkills;
    }
}
