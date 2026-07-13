package com.skillstack.suite.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/** 创建套件入参。 */
@Data
public class CreateSuiteReq {

    @NotBlank
    @Size(max = 96)
    @Pattern(regexp = "^[a-z0-9][a-z0-9-]*$", message = "slug 只允许小写字母、数字、短横线,且以字母数字开头")
    private String slug;

    @NotBlank
    @Size(max = 128)
    private String name;

    @Size(max = 512)
    private String description;

    /** PUBLIC / TEAM_PRIVATE,默认 TEAM_PRIVATE。 */
    @Pattern(regexp = "^(PUBLIC|TEAM_PRIVATE)$")
    private String visibility = "TEAM_PRIVATE";

    /** 初始包含的 skillId 列表,按数组顺序作为 position。可为空。 */
    private List<Long> skillIds;

    /** 新版混合资产列表；为空时回退 skillIds。 */
    private List<UpdateSuiteItemsReq.Item> items;
}
