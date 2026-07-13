package com.skillstack.review.dto;

import lombok.Data;

/**
 * 审核评论列表项（REV-006）— 对齐前端 SubmissionComment。
 */
@Data
public class ReviewCommentItem {
    private Long id;
    /** mine / review */
    private String kind;
    private String body;
    /** YYYY-MM-DD HH:mm */
    private String ts;
    private Author author;

    @Data
    public static class Author {
        private Long id;
        private String handle;
        private String name;
        private String avatar;
        /**
         * 头像图片 URL。SQL 用 {@code COALESCE(u.avatar_url, u.feishu_avatar_url)} 取值，
         * 经 {@code StorageUrlTypeHandler} 自动解析为完整 URL。
         */
        private String avatarUrl;
        /** 提交者 / 审核人 / 成员 — 仅用于前端展示 */
        private String role;
    }
}
