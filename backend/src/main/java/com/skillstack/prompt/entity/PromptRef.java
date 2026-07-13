package com.skillstack.prompt.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prompt_refs")
public class PromptRef extends BaseEntity {
    private Long sourcePromptId;
    private Long sourceVersionId;
    private Long referencedPromptId;
    private String displayLabel;
    private Integer position;
}
