package com.skillstack.admin.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class AdminAddTeamMemberReq {
    @NotNull(message = "userId 不能为空")
    private Long userId;

    @NotNull(message = "role 不能为空")
    @Pattern(regexp = "ADMIN|MEMBER", message = "role 只允许 ADMIN 或 MEMBER")
    private String role;
}
