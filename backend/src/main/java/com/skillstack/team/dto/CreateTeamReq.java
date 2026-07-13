package com.skillstack.team.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateTeamReq {
    @NotBlank(message = "团队名称不能为空")
    @Size(min = 2, max = 64, message = "团队名称长度 2-64")
    private String name;

    @Size(max = 64, message = "slug 最长 64 个字符")
    @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,94}$", message = "slug 必须为英文小写字母 / 数字 / 短横线")
    private String slug;
}
