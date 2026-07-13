package com.skillstack.suite.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("suite_items")
public class SuiteItem extends BaseEntity {
    private Long suiteId;
    /** SKILL / PROMPT */
    private String itemType;
    /** 通用资产 id；迁移期 skillId 仍保留兼容旧链路。 */
    private Long itemId;
    private Long skillId;
    private Integer position;
}
