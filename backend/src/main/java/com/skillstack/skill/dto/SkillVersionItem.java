package com.skillstack.skill.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 版本列表项，对齐 screen-detail-parts.jsx VersionRow。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillVersionItem {
    private Long id;
    private String version;
    /** changelog 第一行作为 note（列表预览） */
    private String note;
    /** changelog 全文（展开时显示） */
    private String changelog;
    /** YYYY-MM-DD */
    private String date;
    private String author;
    private Integer installs;
    private String safety;
    private Integer evalScore;
    private Integer filesCount;
    /** 当前是否最新（与 skills.version 一致） */
    private Boolean latest;
}
