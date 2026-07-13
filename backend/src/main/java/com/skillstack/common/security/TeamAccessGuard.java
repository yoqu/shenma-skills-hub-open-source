package com.skillstack.common.security;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.service.TeamService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

/**
 * 团队访问门卫。
 *
 * <p>所有跨团队接口（成员列表、活动流、Skill 团队库、Suite 列表/写、审核 …）
 * 都应通过这里的方法做一次性、统一的校验。</p>
 *
 * <p>{@code SUPER_ADMIN} 用户在三处中央卡口（requireMember / requireWriter / isWriter）
 * 自动 bypass，返回 {@link PermissionService#virtualSuperAdmin(Long, Long)} 合成的
 * "虚拟 ADMIN 成员"，便于下游 {@code member.getRole()} 调用无 NPE。</p>
 *
 * <ul>
 *   <li>{@link #requireLogin(Long)}：仅要求登录，未登录抛 401（业务码 40100）</li>
 *   <li>{@link #requireMember(Long, Long)}：要求是团队成员，否则 403</li>
 *   <li>{@link #requireWriter(Long, Long)}：要求是 OWNER 或 ADMIN，否则 403</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class TeamAccessGuard {

    private final TeamService teamService;
    @Lazy
    private final PermissionService permissionService;

    public Long requireLogin(Long userId) {
        if (userId == null) {
            throw new BusinessException(40100, "请先登录");
        }
        return userId;
    }

    public TeamMember requireMember(Long teamId, Long userId) {
        requireLogin(userId);
        teamService.requireTeam(teamId);
        if (permissionService.isSuperAdmin(userId)) {
            return PermissionService.virtualSuperAdmin(teamId, userId);
        }
        return teamService.requireMembership(teamId, userId);
    }

    public TeamMember requireWriter(Long teamId, Long userId) {
        requireLogin(userId);
        teamService.requireTeam(teamId);
        if (permissionService.isSuperAdmin(userId)) {
            return PermissionService.virtualSuperAdmin(teamId, userId);
        }
        return teamService.requireWriter(teamId, userId);
    }

    /**
     * 判定 userId 是否为团队 OWNER/ADMIN（不抛异常版本，便于条件分支）。
     * userId 为 null 或不是成员均返回 false；SUPER_ADMIN 直接为 true。
     */
    public boolean isWriter(Long teamId, Long userId) {
        if (teamId == null || userId == null) return false;
        if (permissionService.isSuperAdmin(userId)) return true;
        try {
            teamService.requireWriter(teamId, userId);
            return true;
        } catch (BusinessException e) {
            return false;
        }
    }
}
