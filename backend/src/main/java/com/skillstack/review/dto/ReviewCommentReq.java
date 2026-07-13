package com.skillstack.review.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ReviewCommentReq {
    @NotBlank(message = "回复内容不能为空")
    @Size(max = 2000, message = "回复内容过长")
    private String body;
}
