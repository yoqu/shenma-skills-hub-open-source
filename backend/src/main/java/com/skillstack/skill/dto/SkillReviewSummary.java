package com.skillstack.skill.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/** 评分聚合 + 评论列表，公共可见。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillReviewSummary {
    /** AVG(rating)，无评论时为 0；保留两位小数 */
    private BigDecimal avg;
    private Long total;
    /** 1-5 星各档评论数（5..1 倒序） */
    private List<RatingBucket> distribution;
    private List<SkillReviewItem> items;
    /** 当前登录用户已经写过的评论 id（无则 null） */
    private Long myReviewId;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RatingBucket {
        private Integer star;
        private Long count;
    }
}
