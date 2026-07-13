package com.skillstack.review.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("reviews")
public class Review extends BaseEntity {
    /** 业务编号 r-1042 */
    private String code;
    /** SKILL / PROMPT */
    private String targetType;
    /** 已物化资产 id，首次创建审核通过前可空 */
    private Long targetId;
    /** 通用展示 slug */
    private String displaySlug;
    /** 通用展示名称 */
    private String displayName;
    /** 各类型提交 payload 快照 */
    private String payloadJson;
    /** 关联 skill（已建档），可空 */
    private Long skillId;
    private String skillSlug;
    private String skillName;
    private String shortDesc;
    /** 长篇 Markdown 介绍快照，approve 时复制到 skills.description_md */
    private String descriptionMd;
    /** 分类 code，approve 时复制到 skills.cat_code */
    private String catCode;
    /** 图标，approve 时复制到 skills.icon */
    private String icon;
    /** 自定义上传图标 storage key（raw），approve 时复制到 skills/prompts.icon_url */
    private String iconUrl;
    /** 语言数组 JSON 快照 */
    private String langsJson;
    /** 标签数组 JSON 快照（仅审核期使用，approve 时才注册到 tags + 建 skill_tag） */
    private String tagsJson;
    /** CREATE（首次提交）或 VERSION_BUMP（发新版本）；分流 approve 物化逻辑 */
    private String kind;
    private Long teamId;
    private Long submitterId;
    /** PUBLIC / TEAM_PRIVATE */
    private String visibility;
    private Integer filesCount;
    private String version;
    /** pass / warn / fail */
    private String safety;
    private Integer evalScore;
    /** DRAFT / PENDING_REVIEW / APPROVED / REJECTED / CHANGES_REQUESTED / WITHDRAWN */
    private String status;
    private String reason;
    /** 本次提交版本的变更说明（作者填写）；与 reason（审核人反馈）语义独立。 */
    private String changelog;
    /** 本次提交对应的 zip storage key；approve 时会复制到 skill_versions.zip_url。 */
    private String zipUrl;
    private Long reviewerId;
    private LocalDateTime submittedAt;
    private LocalDateTime decidedAt;
}
