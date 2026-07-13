package com.skillstack.prompt.entity;

import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prompt_versions")
public class PromptVersion extends BaseEntity {
    private Long promptId;
    private String version;
    private String contentMd;
    private String changelog;
    private String contentSha256;
    private Integer refsCount;
    private LocalDateTime publishedAt;
}
