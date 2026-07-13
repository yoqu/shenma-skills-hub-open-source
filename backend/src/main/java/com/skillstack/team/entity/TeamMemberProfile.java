package com.skillstack.team.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("team_member_profile")
public class TeamMemberProfile extends BaseEntity {
    private Long teamId;
    private Long userId;
    private String displayName;
    private String bio;
    private Boolean showEmail;
}
