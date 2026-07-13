package com.skillstack.skill.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("skill_review_replies")
public class SkillReviewReply extends BaseEntity {
    private Long reviewId;
    private Long authorId;
    private String body;
}
