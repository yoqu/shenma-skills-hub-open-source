package com.skillstack.review.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 审核记录上的对话评论（REV-006）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("review_comments")
public class ReviewComment extends BaseEntity {
    private Long reviewId;
    private Long authorId;
    /** mine / review */
    private String kind;
    private String body;
}
