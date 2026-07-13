package com.skillstack.prompt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResolvePromptReq {
    @NotBlank
    @Size(max = 262144)
    private String contentMd;

    @NotBlank
    private String teamSlug;

    private Boolean raw;
}
