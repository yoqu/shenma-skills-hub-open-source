package com.skillstack.suite.dto;

import lombok.Data;

/** 套件内的 Skill 简要(给套件编辑器/详情用)。 */
@Data
public class SkillInSuite {
    private Long id;
    private String slug;
    private String name;
    /** 对齐前端 short 字段(JS 关键字所以叫 shortDesc)。 */
    private String shortDesc;
    private String catCode;
    private String icon;
    /** 自定义上传图标完整 URL（DB 存 storage key，已解析为对外完整 URL）。 */
    private String iconUrl;
    private String version;
    private String visibility;
    private Integer installs;
    private Integer stars;
    /** 在套件内的位置 1..N。 */
    private Integer position;
}
