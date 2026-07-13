package com.skillstack.review.dto;

import lombok.Data;

import java.util.List;

/**
 * 审核详情 — 对齐 screen-team-reviews-pane。
 * 文件树由独立接口 GET /api/reviews/{id}/files 提供；
 * safetyReport / history 字段在 service 中按当前可得数据填充。
 */
@Data
public class ReviewDetail {
    /** 业务编号 r-1042 */
    private String id;
    private Long rowId;
    private String targetType;
    private Long targetId;
    private String slug;
    private String name;
    private String shortDesc;
    private String descriptionMd;
    private String visibility;
    private String version;
    private Integer files;
    private String safety;
    private Integer evalScore;
    private String status;
    private String reason;
    /** 作者填写的本次版本变更说明（SKILL-VER-001） */
    private String changelog;
    /** 当前已发布的 skill 版本号；null 表示首次审核 */
    private String previousVersion;
    /** 是否为发新版本审核（version 不同于 skill 当前版本） */
    private Boolean isVersionBump;
    /** CREATE / VERSION_BUMP */
    private String kind;
    private String catCode;
    private String icon;
    /** 自定义上传图标完整 URL（无则为 null，rework 预览用） */
    private String iconUrl;
    private List<String> langs;
    private List<String> tags;
    /** review-first 流程中，作者可编辑 payload 时填回的 zip storage key（前端预览用） */
    private String zipUrl;
    private String payloadJson;
    private String submittedAt;
    private ReviewListItem.Submitter submittedBy;

    private SafetyReport safetyReport;
    private List<HistoryEntry> history;

    @Data
    public static class SafetyIssue {
        /** info / warn / error */
        private String level;
        private String file;
        private String message;
    }

    @Data
    public static class SafetyReport {
        private String overall;
        private List<SafetyIssue> issues;
    }

    @Data
    public static class HistoryEntry {
        private String at;
        private String actor;
        private String action;
        private String comment;
    }
}
