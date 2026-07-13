package com.skillstack.suite.dto;

import lombok.Data;

import java.time.LocalDateTime;

/** 套件列表项,对齐 design-ui 的 SUITES 字段。 */
@Data
public class SuiteListItem {
    private Long id;
    private String slug;
    private String name;
    /** 对齐前端 desc 字段。 */
    private String desc;
    private String visibility;
    /** 套件内 skill 数量(冗余)。 */
    private Integer skills;
    private Integer installs;
    /** 最近更新时间(前端按 .slice(5) 展示 MM-DD)。 */
    private LocalDateTime updatedAt;
}
