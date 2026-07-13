package com.skillstack.asset.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("asset_reviews")
public class AssetReview extends BaseEntity {
    private String targetType;
    private Long targetId;
    private Long userId;
    private Integer rating;
    private String body;
    private String version;
}
