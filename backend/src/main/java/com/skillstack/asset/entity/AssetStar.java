package com.skillstack.asset.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("asset_stars")
public class AssetStar extends BaseEntity {
    private String targetType;
    private Long targetId;
    private Long userId;
}
