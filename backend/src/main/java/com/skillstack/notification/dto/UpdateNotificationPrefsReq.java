package com.skillstack.notification.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;
import java.util.List;

@Data
public class UpdateNotificationPrefsReq {
    @NotEmpty
    private List<Entry> entries;

    @Data
    public static class Entry {
        private String key;
        private String channel;
        private Boolean enabled;
    }
}
