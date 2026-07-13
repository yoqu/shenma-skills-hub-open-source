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
public class AdminTeamListItemVO {
    private Long id;
    private String slug;
    private String name;
    private String ownerHandle;
    private String ownerName;
    private Integer membersCount;
    private Integer skillsCount;
    private Integer suitesCount;
    /** ACTIVE / DISABLED */
    private String status;
    private LocalDateTime createdAt;
}
