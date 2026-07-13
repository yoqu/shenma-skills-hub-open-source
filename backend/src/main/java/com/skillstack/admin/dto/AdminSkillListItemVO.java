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
public class AdminSkillListItemVO {
    private Long id;
    private String slug;
    private String name;
    private Long teamId;
    private String teamName;
    private Long authorId;
    private String authorHandle;
    /** DRAFT / PENDING / APPROVED / REJECTED / UNLISTED / ARCHIVED (admin-only) */
    private String status;
    /** PUBLIC / TEAM_PRIVATE */
    private String visibility;
    private Integer installs;
    private Integer stars;
    private LocalDateTime publishedAt;
}
