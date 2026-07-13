package com.skillstack.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 注册第 4 步：可选邀请码 inviteCode，不填则仅创建个人账号。
 */
@Data
public class RegisterStep4Req {
    @NotBlank(message = "不能为空")
    private String regToken;

    private String inviteCode;
}
