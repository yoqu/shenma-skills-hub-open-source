package com.skillstack.team.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("team_members")
public class TeamMember extends BaseEntity {
    private Long teamId;
    private Long userId;
    /** OWNER / ADMIN / MEMBER / VIEWER */
    private String role;
    private Integer skillsCount;
    private LocalDateTime joinedAt;
    private LocalDateTime lastActiveAt;
    private String lastActiveLabel;
}
