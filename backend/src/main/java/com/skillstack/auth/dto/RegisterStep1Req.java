package com.skillstack.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class RegisterStep1Req {
    @NotBlank(message = "不能为空")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "请输入有效的 11 位手机号")
    private String phone;

    @NotBlank(message = "不能为空")
    private String smsCode;
}
