package com.skillstack.notification.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class NotificationItem {
    private Long id;
    private String type;
    private String category;
    private String title;
    private String body;
    private Long teamId;
    private String teamName;
    private Long actorId;
    private String actorName;
    private String targetUrl;
    private boolean read;
    private LocalDateTime createdAt;
}
