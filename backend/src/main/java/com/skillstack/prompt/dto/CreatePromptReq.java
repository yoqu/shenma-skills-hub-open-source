package com.skillstack.prompt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class CreatePromptReq {
    @NotBlank
    @Size(max = 128)
    private String name;

    @NotBlank
    @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,94}$", message = "slug 必须为小写字母 / 数字 / 短横线")
    private String slug;

    @NotBlank
    @Size(max = 512)
    private String shortDesc;

    @NotBlank
    private String cat;

    @NotBlank
    @Pattern(regexp = "^(PUBLIC|TEAM_PRIVATE)$")
    private String visibility;

    @NotBlank
    @Pattern(regexp = "^\\d+\\.\\d+\\.\\d+(?:[-+][0-9A-Za-z.-]+)?$",
            message = "version 必须符合 SemVer,如 0.1.0")
    private String version;

    @NotNull
    private Long teamId;

    @NotBlank
    @Size(max = 262144)
    private String contentMd;

    @Size(max = 1024)
    private String changelog;

    private List<String> tags;
    private Boolean draft;

    /** 自定义上传图标 storage key（来自 /api/prompts/icon-images）。 */
    private String iconKey;
}
