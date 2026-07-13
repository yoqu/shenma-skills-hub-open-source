package com.skillstack.admin.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AdminUpdateTeamReq {
    @Size(min = 1, max = 60, message = "name 长度需在 1-60 之间")
    private String name;

    @Pattern(regexp = "[a-z0-9-]{2,40}", message = "slug 只允许小写字母/数字/-，长度 2-40")
    private String slug;

    @Pattern(regexp = "ACTIVE|DISABLED", message = "status 仅允许 ACTIVE 或 DISABLED")
    private String status;
}
