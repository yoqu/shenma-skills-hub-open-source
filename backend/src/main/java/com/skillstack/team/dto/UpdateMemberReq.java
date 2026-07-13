package com.skillstack.team.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateMemberReq {
    /** OWNER / ADMIN / MEMBER / VIEWER */
    @NotBlank
    private String role;
}
