package com.skillstack.userskill.dto;

import com.skillstack.skill.dto.SkillCard;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserSkillItem {
    private Long id;
    private String source;
    private Long skillId;
    private Long reviewId;
    private String slug;
    private String name;
    private String shortDesc;
    private String catCode;
    private String icon;
    private String version;
    private String zipUrl;
    private Integer filesCount;
    private String safety;
    private Integer evalScore;
    private String langs;
    private String publicVersion;
    private String publicStatus;
    private String publicVisibility;
    private Boolean publicDeleted;
    private Integer publicInstalls;
    private Integer publicStars;
    private SkillCard.AuthorRef author;
    private String createdAt;
    private String updatedAt;
}
