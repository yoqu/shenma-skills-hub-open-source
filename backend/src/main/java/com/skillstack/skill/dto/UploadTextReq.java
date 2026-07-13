package com.skillstack.skill.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** {@code POST /api/skills/versions/upload-text} 请求体——粘贴 SKILL.md 内容。 */
@Data
public class UploadTextReq {
    @NotBlank
    @Size(max = 262_144, message = "SKILL.md 文本不能超过 256 KB")
    private String content;
}
