package com.skillstack.suite.dto;

import lombok.Data;

@Data
public class SuiteAssetItem {
    private String type;
    private Long id;
    private String slug;
    private String name;
    private String shortDesc;
    private String catCode;
    /** Skill 单字符兜底图标（PROMPT 为空）。 */
    private String icon;
    /** Skill 自定义上传图标完整 URL（DB 存 storage key，已解析；PROMPT 为空）。 */
    private String iconUrl;
    private String version;
    private String visibility;
    private Integer installs;
    private Integer stars;
    private Integer exports;
    private Integer position;
}
