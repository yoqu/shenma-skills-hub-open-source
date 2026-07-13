package com.skillstack.skill.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("skill_version_files")
public class SkillVersionFile extends BaseEntity {
    private Long versionId;
    private String path;
    private Long size;
    private Integer sort;
}
