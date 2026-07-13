package com.skillstack.notification.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("notification_pref")
public class NotificationPref extends BaseEntity {
    private Long userId;
    private Long teamId;
    private String prefKey;
    private String channel;
    private Boolean enabled;
}
