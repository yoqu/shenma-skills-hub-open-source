package com.skillstack.skill.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** 详情页概述区展示的 SKILL.md 文本内容。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillMdContent {
    private String path;
    private String content;
    private Long size;
    private Boolean truncated;
}
