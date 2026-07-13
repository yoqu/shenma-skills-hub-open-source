package com.skillstack.userskill.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UserSkillSubscribeReq {
    @NotNull
    private Long skillId;
}
