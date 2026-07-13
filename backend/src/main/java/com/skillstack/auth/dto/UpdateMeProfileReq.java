package com.skillstack.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateMeProfileReq {
    @NotBlank(message = "显示名不能为空")
    @Size(max = 64, message = "显示名不能超过 64 个字符")
    private String name;

    @Email(message = "邮箱格式不正确")
    @Size(max = 128, message = "邮箱不能超过 128 个字符")
    private String email;

    @Size(max = 8, message = "头像字符不能超过 8 个字符")
    private String avatar;
}
