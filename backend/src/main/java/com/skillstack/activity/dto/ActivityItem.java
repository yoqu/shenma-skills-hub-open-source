package com.skillstack.activity.dto;

import lombok.Data;

import java.time.LocalDateTime;

/** 团队活动流条目,字段对齐 design-ui 的 ACTIVITY 数组。 */
@Data
public class ActivityItem {
    private Long id;
    /** 活动类型 approve|submit|invite|release|unlist|join|suite|... */
    private String kind;

    // ---- actor ----
    private Long actorId;
    /** actor name(前端 who 字段)。 */
    private String actor;
    private String actorHandle;
    /** 字符占位（首字符），用于头像图片加载失败时兜底。 */
    private String actorAvatar;
    /**
     * actor 头像图片 URL。SQL 用 {@code COALESCE(u.avatar_url, u.feishu_avatar_url)} 取值，
     * 经 {@code StorageUrlResolver} / {@code StorageUrlTypeHandler} 解析为完整 URL。
     */
    private String actorAvatarUrl;

    // ---- target ----
    /** 目标展示文本(对齐前端 target 字段)。 */
    private String target;
    private Long targetSkillId;
    private String targetSkillSlug;
    private Long targetSuiteId;
    private String targetSuiteSlug;

    /** 附加描述(对齐前端 extra 字段)。 */
    private String extra;

    /** 后端预格式化文本(seed 写好的 "12 分钟前")。 */
    private String timeAgo;
    /** 原始时间戳,前端也可以自己 format。 */
    private LocalDateTime createdAt;
}
