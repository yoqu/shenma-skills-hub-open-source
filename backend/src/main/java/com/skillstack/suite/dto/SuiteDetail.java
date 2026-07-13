package com.skillstack.suite.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/** 套件详情:套件本体 + 内部 skill 列表(已按 position 排序)。 */
@Data
public class SuiteDetail {
    private Long id;
    private String slug;
    private String name;
    private String desc;
    private Long teamId;
    private String teamSlug;
    private String teamName;
    private String visibility;
    private Integer installs;
    private Integer skillsCount;
    private LocalDateTime updatedAt;
    private List<SuiteAssetItem> items;
    private List<SkillInSuite> skills;
}
