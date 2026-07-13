package com.skillstack.skill.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("skill_versions")
public class SkillVersion extends BaseEntity {
    private Long skillId;
    private String version;
    private String changelog;
    /** storage key（相对路径）。审核包文件预览与下载从此读取。 */
    private String zipUrl;
    private Integer filesCount;
    /** pass / warn / fail */
    private String safety;
    private Integer evalScore;
    private LocalDateTime publishedAt;
}
