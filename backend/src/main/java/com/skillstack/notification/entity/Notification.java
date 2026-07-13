package com.skillstack.notification.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("notifications")
public class Notification extends BaseEntity {
    private Long userId;
    private Long teamId;
    private String type;
    private String category;
    private String title;
    private String body;
    private String targetUrl;
    private Long actorId;
    private String sourceType;
    private Long sourceId;
    private LocalDateTime readAt;
}
