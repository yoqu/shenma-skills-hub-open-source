package com.skillstack.skill.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("categories")
public class Category extends BaseEntity {
    private String code;
    private String name;
    private Integer count;
    private Integer sort;
}
