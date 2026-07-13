package com.skillstack.review.dto;

import lombok.Data;

/**
 * 审核决策入参 — approve / reject / request-changes 共用。
 *
 * - approve: comment 可空
 * - reject:  reason 必填（在 service 层校验）
 * - request-changes: reason 必填
 */
@Data
public class ReviewDecisionReq {
    private String comment;
    private String reason;
}
