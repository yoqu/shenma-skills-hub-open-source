package com.skillstack.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserDetailVO {
    private Long id;
    private String handle;
    private String name;
    private String email;
    private String phone;
    private String avatarUrl;
    private String platformRole;
    private String status;
    private Integer teamsCount;
    private LocalDateTime joinedAt;
    private LocalDateTime lastLogin;
    private String bio;
    private List<TeamRef> teams;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeamRef {
        private Long id;
        private String slug;
        private String name;
        /** OWNER / ADMIN / MEMBER / VIEWER */
        private String role;
    }
}
