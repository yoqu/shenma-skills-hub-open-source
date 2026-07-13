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
public class AdminUserListItemVO {
    private Long id;
    private String handle;
    private String name;
    private String email;
    private String phone;
    private String avatarUrl;
    /** USER / SUPER_ADMIN */
    private String platformRole;
    /** ACTIVE / DISABLED */
    private String status;
    private Integer teamsCount;
    private LocalDateTime joinedAt;
    private LocalDateTime lastLogin;
}
