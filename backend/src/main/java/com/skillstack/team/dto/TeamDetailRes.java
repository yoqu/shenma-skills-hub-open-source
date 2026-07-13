package com.skillstack.team.dto;

import java.time.LocalDateTime;
import lombok.Data;

/** 公开主页 / 设置页通用的团队详情。 */
@Data
public class TeamDetailRes {
    private Long id;
    private String slug;
    private String name;
    private String description;
    private String avatar;
    private String logoUrl;
    private String color;
    private Integer members;
    private Integer publicSkills;
    private Integer privateSkills;
    private Integer suites;
    private String reviewMode;
    private Boolean publicHome;
    private LocalDateTime createdAt;
}
