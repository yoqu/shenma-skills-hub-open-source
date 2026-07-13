package com.skillstack.auth.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 登录入参：
 * - 密码登录：identifier(handle/email/phone) + password
 * - 短信登录：phone + smsCode
 *
 * 这里不能强制 @NotBlank，因为两种模式互斥；具体哪种凭据缺失由 AuthService 判定，
 * 但仍然校验单字段的长度上限以防御过长输入。
 */
@Data
public class LoginReq {
    @Size(max = 128, message = "标识符过长")
    private String identifier;

    @Size(max = 64, message = "密码长度不合法")
    private String password;

    @Size(max = 32, message = "手机号过长")
    private String phone;

    @Size(max = 8, message = "验证码格式不正确")
    private String smsCode;

    /**
     * "7 天免登录" 勾选状态。true 时后端签发长期 token，否则短期 token（AUTH-009）。
     */
    private Boolean remember;

    /** 可选：注册 step3 时一并保存 bio / avatarColor。 */
    private String avatarColor;
}
