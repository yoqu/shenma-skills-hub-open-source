package com.skillstack.skill.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("skills")
public class Skill extends BaseEntity {
    private String slug;
    private String name;
    private String shortDesc;
    /** 长篇 Markdown 介绍（可含图片），与 shortDesc 区分 */
    private String descriptionMd;
    /** 关联 categories.code */
    private String catCode;
    private String icon;
    /** 自定义上传图标 storage key（raw）。保持 raw，删除旧文件时需要原值，禁止挂 StorageUrlTypeHandler。 */
    private String iconUrl;
    private String version;
    /** PUBLIC / TEAM_PRIVATE */
    private String visibility;
    /** DRAFT / PENDING / APPROVED / REJECTED / UNLISTED */
    private String status;
    private Long authorId;
    private Long teamId;
    private Integer installs;
    private Integer stars;
    private BigDecimal score;
    /** pass / warn / fail */
    private String safety;
    private Integer evalScore;
    /** JSON 字符串 ["TS","Py"] */
    private String langs;
    private LocalDateTime publishedAt;
}
