package com.skillstack.team.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreatePhoneInviteReq {
    /**
     * 中国大陆手机号 — 仅放行 1[3-9]\d{9}（TEAM-PHONE-004）。
     */
    @NotBlank
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "请输入有效的 11 位手机号")
    private String phone;

    @Size(max = 255)
    private String note;
}
