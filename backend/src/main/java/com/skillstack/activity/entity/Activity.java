package com.skillstack.activity.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("activity")
public class Activity extends BaseEntity {
    private Long teamId;
    private Long actorId;
    /** approve|submit|invite|release|unlist|join|suite|... */
    private String kind;
    /** 展示用目标文本(slug 或自然语言)。 */
    private String target;
    private Long targetSkillId;
    private Long targetSuiteId;
    private String extra;
    /** 展示用相对时间(seed 已写入)。 */
    private String whenLabel;
}
