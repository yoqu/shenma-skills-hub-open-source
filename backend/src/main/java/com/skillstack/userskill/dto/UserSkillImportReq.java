package com.skillstack.userskill.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class UserSkillImportReq {
    @NotBlank
    @Size(max = 128)
    private String name;

    @NotBlank
    @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,94}$", message = "slug 必须为小写字母 / 数字 / 短横线")
    private String slug;

    @Size(max = 512)
    private String shortDesc;

    @Size(max = 32)
    private String catCode;

    @Size(max = 64)
    private String icon;

    @NotBlank
    @Pattern(regexp = "^\\d+\\.\\d+\\.\\d+(?:[-+][0-9A-Za-z.-]+)?$", message = "version 必须符合 SemVer,如 0.1.0")
    private String version;

    @NotBlank
    @Size(max = 512)
    private String zipUrl;

    private Integer filesCount;

    private List<String> langs;
}
