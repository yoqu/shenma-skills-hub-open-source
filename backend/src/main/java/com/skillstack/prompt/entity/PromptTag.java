package com.skillstack.prompt.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prompt_tags")
public class PromptTag extends BaseEntity {
    private Long promptId;
    private Long tagId;
}
