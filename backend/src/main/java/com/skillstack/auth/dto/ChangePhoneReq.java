package com.skillstack.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class ChangePhoneReq {
    @NotBlank(message = "当前密码不能为空")
    private String currentPassword;

    @NotBlank(message = "手机号不能为空")
    @Pattern(regexp = "^[0-9+\\-\\s()]{6,32}$", message = "手机号格式不正确")
    private String phone;

    @NotBlank(message = "验证码不能为空")
    @Pattern(regexp = "^\\d{6}$", message = "验证码必须为 6 位数字")
    private String smsCode;
}
