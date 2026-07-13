package com.skillstack.skill.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SubmitSkillReviewReplyReq {
    @NotBlank
    @Size(max = 2000)
    private String body;
}
