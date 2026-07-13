package com.skillstack.skill.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** 单条 skill 评分/评论 + 作者回复。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillReviewItem {
    private Long id;
    private UserRef user;
    private Integer rating;
    private String version;
    /** YYYY-MM-DD */
    private String date;
    private String body;
    /** true if this review is written by the current viewer */
    private Boolean mine;
    private List<ReplyItem> replies;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserRef {
        private Long id;
        private String name;
        private String handle;
        private String avatar;
        /** 头像图片 URL（上传 / 飞书 SSO 解析后填充）。无图时前端用 {@code avatar} 字符占位。 */
        private String avatarUrl;
        private String color;
        private Boolean isAuthor;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReplyItem {
        private Long id;
        private UserRef user;
        /** YYYY-MM-DD */
        private String date;
        private String body;
    }
}
