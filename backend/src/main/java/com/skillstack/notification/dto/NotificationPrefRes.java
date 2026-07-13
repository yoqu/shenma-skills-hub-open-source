package com.skillstack.notification.dto;

import lombok.Data;
import java.util.Map;

@Data
public class NotificationPrefRes {
    /** key → channel → enabled */
    private Map<String, Map<String, Boolean>> prefs;
}
