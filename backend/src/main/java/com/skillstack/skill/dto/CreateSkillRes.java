package com.skillstack.skill.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateSkillRes {
    private Long id;
    private String slug;
    /** DRAFT / PENDING / APPROVED */
    private String status;
    /** 是否进入审核队列 */
    private Boolean pendingReview;
    /** review-first 流程下，新建的 review 行 PK；DIRECT_PUBLISH 直接物化时为 null。 */
    private Long reviewId;
}
