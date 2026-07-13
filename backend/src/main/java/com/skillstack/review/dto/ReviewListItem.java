package com.skillstack.review.dto;

import lombok.Data;

/**
 * 审核队列卡片 — 对齐前端 REVIEWS / screen-team-reviews-list.jsx。
 */
@Data
public class ReviewListItem {
    /** 业务编号 r-1042（前端 list 用作 key） */
    private String id;
    /** 行 PK，前端拿来做后续 detail 请求 */
    private Long rowId;
    private String targetType;
    private Long targetId;
    /** 关联 skill 主键（已建档场景下用于"发新版本"等 mutation） */
    private Long skillId;
    private String slug;
    private String name;
    private String shortDesc;
    private String visibility;
    private Integer files;
    private String version;
    /** pass / warn / fail */
    private String safety;
    private Integer evalScore;
    /** PENDING_REVIEW / APPROVED / REJECTED / CHANGES_REQUESTED / WITHDRAWN */
    private String status;
    private String reason;
    /** 作者填写的本次版本变更说明（非空 ≈ 发新版本审核，SKILL-VER-001） */
    private String changelog;
    /** CREATE / VERSION_BUMP */
    private String kind;
    private String catCode;
    private String icon;
    private String langsJson;
    private String tagsJson;
    private String submittedAt;
    private Submitter submittedBy;

    @Data
    public static class Submitter {
        private Long id;
        private String handle;
        private String name;
        private String avatar;
        /**
         * 头像图片 URL。SQL 用 {@code COALESCE(u.avatar_url, u.feishu_avatar_url)} 取值，
         * 经 {@code StorageUrlTypeHandler} 自动解析为完整 URL。
         */
        private String avatarUrl;
    }
}
