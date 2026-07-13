package com.skillstack.skill.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * 广场卡片 / 列表项。对齐 data-skills.jsx SKILLS。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillCard {
    private Long id;
    private String slug;
    private String name;
    /** 一句话描述 */
    private String shortDesc;
    /** 分类 code: dev/data/... */
    private String cat;
    private String icon;
    /** 自定义上传图标完整 URL（无则为 null，前端回退到字母/分类图） */
    private String iconUrl;
    private Integer installs;
    private Integer stars;
    private BigDecimal score;
    private String version;
    /** YYYY-MM-DD 更新日期（取 publishedAt） */
    private String updated;
    private String visibility;
    private String status;
    /** 来源团队 slug */
    private String team;
    /** 安全等级 */
    private String safety;
    private Integer evalScore;
    private List<String> langs;
    private List<String> tags;
    private AuthorRef author;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AuthorRef {
        private Long id;
        private String name;
        private String handle;
    }
}
