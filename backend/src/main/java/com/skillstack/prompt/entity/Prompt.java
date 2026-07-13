package com.skillstack.prompt.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prompts")
public class Prompt extends BaseEntity {
    private Long teamId;
    private String slug;
    private String name;
    private String shortDesc;
    private String catCode;
    /** 自定义上传图标 storage key（raw）。保持 raw，删除旧文件时需要原值，禁止挂 StorageUrlTypeHandler。 */
    private String iconUrl;
    private String visibility;
    private String status;
    private String version;
    private Long authorId;
    private BigDecimal score;
    private Integer stars;
    private Integer exports;
    private Long currentVersionId;
    private LocalDateTime publishedAt;
}
