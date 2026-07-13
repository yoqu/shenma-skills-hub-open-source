package com.skillstack.team.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateTeamMemberProfileReq {
    @NotBlank(message = "显示名不能为空")
    @Size(max = 32, message = "显示名最长 32 字")
    private String displayName;

    @Size(max = 60, message = "简介最长 60 字")
    private String bio;

    private Boolean showEmail;
}
