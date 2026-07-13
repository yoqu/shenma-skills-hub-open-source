package com.skillstack.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SiteSettingVO {
    private String key;
    private String value;
    private String valueType;
    private Long updatedBy;
    private LocalDateTime updatedAt;
}
