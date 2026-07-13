package com.skillstack.suite.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("suites")
public class Suite extends BaseEntity {
    private String slug;
    private String name;
    private String description;
    private Long teamId;
    /** PUBLIC / TEAM_PRIVATE */
    private String visibility;
    private Integer installs;
    private Integer skillsCount;
}
