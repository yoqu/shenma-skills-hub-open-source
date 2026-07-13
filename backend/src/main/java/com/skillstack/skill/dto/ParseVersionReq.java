package com.skillstack.skill.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** {@code POST /api/skills/versions/parse} 请求体。 */
@Data
public class ParseVersionReq {
    /** 上传接口返回的存储 key。 */
    @NotBlank
    private String zipUrl;
}
