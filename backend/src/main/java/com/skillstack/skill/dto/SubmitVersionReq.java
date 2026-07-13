package com.skillstack.skill.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 发新版本请求（SKILL-VER-001）。
 */
@Data
public class SubmitVersionReq {
    @NotBlank(message = "新版本号不能为空")
    @Size(max = 32, message = "版本号过长")
    private String version;

    @Size(max = 1024, message = "变更说明过长")
    private String changelog;

    /** 已经上传到 storage 的 zip key（通过 POST /api/skills/versions/upload 获得）。 */
    @Size(max = 512)
    private String zipUrl;
}
