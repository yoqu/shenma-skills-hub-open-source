package com.skillstack.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterStep2Req {
    @NotBlank(message = "不能为空")
    private String regToken;

    @NotBlank(message = "不能为空")
    @Pattern(regexp = "^[a-z0-9_]{3,32}$", message = "只能包含小写字母 / 数字 / 下划线，长度 3-32")
    private String handle;

    @NotBlank(message = "不能为空")
    @Size(max = 64, message = "长度不能超过 64")
    private String name;

    @NotBlank(message = "不能为空")
    @Email(message = "邮箱格式不正确")
    @Size(max = 128, message = "长度不能超过 128")
    private String email;

    @NotBlank(message = "不能为空")
    @Size(min = 6, max = 64, message = "长度 6-64")
    private String password;
}
