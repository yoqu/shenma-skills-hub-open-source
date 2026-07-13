package com.skillstack.team.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("teams")
public class Team extends BaseEntity {
    private String slug;
    private String name;
    private String description;
    private String avatarChar;
    private String logoUrl;
    private String color;
    private Integer membersCount;
    private Integer publicSkills;
    private Integer privateSkills;
    private Integer suitesCount;
    private String reviewMode;
    private Boolean publicHome;
    /** ACTIVE / DISABLED */
    private String status;

    /** 非持久化字段，仅供测试或内存组装使用。 */
    @TableField(exist = false)
    private Long ownerId;
}
