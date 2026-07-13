package com.skillstack.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class SmsCodeReq {
    @NotBlank(message = "不能为空")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "请输入有效的 11 位手机号")
    private String phone;

    /**
     * 验证码使用场景：login / register / change_phone。
     * login：要求手机号已注册，未注册返回 40004。
     * register：要求手机号未注册，已注册返回 40020。
     * change_phone 或空：不预校验存在性。
     */
    @Pattern(regexp = "^(login|register|change_phone)?$", message = "非法的 purpose")
    private String purpose;
}
