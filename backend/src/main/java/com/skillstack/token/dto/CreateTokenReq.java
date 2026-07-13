package com.skillstack.token.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateTokenReq {
    @NotBlank @Size(max = 64)
    private String name;
    /** personal | ci */
    @Pattern(regexp = "personal|ci")
    private String kind = "personal";
}
