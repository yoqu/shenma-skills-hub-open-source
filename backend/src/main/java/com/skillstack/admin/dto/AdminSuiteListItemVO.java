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
public class AdminSuiteListItemVO {
    private Long id;
    private String slug;
    private String name;
    private Long teamId;
    private String teamName;
    /** PUBLIC / TEAM_PRIVATE */
    private String visibility;
    private Integer installs;
    private Integer skillsCount;
    private LocalDateTime createdAt;
}
