package com.skillstack.prompt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class SubmitPromptVersionReq {
    @NotBlank
    @Pattern(regexp = "^\\d+\\.\\d+\\.\\d+(?:[-+][0-9A-Za-z.-]+)?$",
            message = "version 必须符合 SemVer,如 0.1.0")
    private String version;

    @NotBlank
    @Size(max = 262144)
    private String contentMd;

    @Size(max = 1024)
    private String changelog;

    private List<String> tags;
}
