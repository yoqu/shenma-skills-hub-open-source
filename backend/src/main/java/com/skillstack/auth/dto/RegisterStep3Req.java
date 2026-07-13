package com.skillstack.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterStep3Req {
    @NotBlank(message = "不能为空")
    private String regToken;

    @Size(max = 8, message = "长度不能超过 8")
    private String avatar;

    @Size(max = 500, message = "长度不能超过 500")
    private String bio;

    /** 头像背景色，#RRGGBB（可选）。 */
    @Size(max = 16, message = "颜色字段过长")
    private String avatarColor;
}
