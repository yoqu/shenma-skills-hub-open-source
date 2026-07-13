package com.skillstack.skill.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("skill_reviews")
public class SkillReview extends BaseEntity {
    private Long skillId;
    private Long userId;
    private Integer rating;
    private String body;
    private String version;
}
