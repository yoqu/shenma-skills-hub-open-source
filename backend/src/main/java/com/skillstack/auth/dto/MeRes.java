package com.skillstack.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 形态参考 docs/design-ui/data.jsx 的 ME + data-team.jsx 的 MY_TEAMS。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MeRes {
    private Long id;
    private String handle;
    private String name;
    private String email;
    private String phone;
    private String avatar;
    private String avatarUrl;
    private String avatarColor;
    private String bio;
    private String role;       // 默认主团队角色（首个团队），便于前端 ME.role 直读
    /** USER / SUPER_ADMIN */
    private String platformRole;
    /** ACTIVE / DISABLED */
    private String status;
    private Long joinedDays;   // 自 joined_at 到现在的天数
    private List<MyTeam> myTeams;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MyTeam {
        private Long id;
        private String slug;
        private String name;
        private String avatar;
        private String color;
        private String role;
        private Integer members;
        private Integer unread;
    }
}
