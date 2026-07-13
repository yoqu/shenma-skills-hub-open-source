package com.skillstack.team.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("user_team_unread")
public class UserTeamUnread extends BaseEntity {
    private Long userId;
    private Long teamId;
    private Integer unread;
}
