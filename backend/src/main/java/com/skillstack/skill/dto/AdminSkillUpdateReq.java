package com.skillstack.skill.dto;

import lombok.Data;

/**
 * 管理员对 Skill 的写操作入参。
 * - visibility：PUBLIC / TEAM_PRIVATE
 * - status：APPROVED / UNLISTED （上下架）
 * - ownerId：转移作者（必须是同团队成员）
 */
@Data
public class AdminSkillUpdateReq {
    private String visibility;
    private String status;
    private Long ownerId;
}
