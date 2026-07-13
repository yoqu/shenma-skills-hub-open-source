package com.skillstack.admin.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("site_settings")
public class SiteSetting {

    @TableId(value = "setting_key", type = IdType.INPUT)
    private String settingKey;

    private String settingValue;

    /** STRING / URL / BOOL / JSON */
    private String valueType;

    private Long updatedBy;
    private LocalDateTime updatedAt;
}
