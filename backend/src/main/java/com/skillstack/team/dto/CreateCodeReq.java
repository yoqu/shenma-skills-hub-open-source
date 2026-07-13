package com.skillstack.team.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateCodeReq {
    @NotNull
    @Min(1)
    @Max(200)
    private Integer max;

    @NotNull
    @Min(1)
    @Max(365)
    private Integer expiresInDays;

    /** ADMIN / MEMBER / VIEWER；默认 MEMBER。 */
    private String role = "MEMBER";
}
