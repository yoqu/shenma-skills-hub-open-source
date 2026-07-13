package com.skillstack.team.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class JoinByCodeReq {
    @NotBlank
    private String code;
}
