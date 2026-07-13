package com.skillstack.common.security;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.team.entity.TeamMember;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * 平台超级管理员判定与团队权限"绕过"工厂。
 *
 * <p>所有跨团队访问点（{@link TeamAccessGuard}、{@code SkillService.isMember}、
 * {@code SuiteService.isMemberSafe} 等）都应通过这里短路 SUPER_ADMIN。</p>
 *
 * <p>安全约束：</p>
 * <ul>
 *   <li>PAT 凭据（{@link CurrentUser#isPat()} 为 true）<b>不</b>享有 bypass。</li>
 *   <li>被禁用账号（{@code status=DISABLED}）<b>不</b>享有 bypass。</li>
 *   <li>仅当 {@code platform_role=SUPER_ADMIN && status=ACTIVE} 才返回 true。</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class PermissionService {

    private final UserMapper userMapper;

    /** 仅按 userId 判定，调用方需自行确认凭据非 PAT。建议优先使用 {@link #isSuperAdmin(CurrentUser)}。 */
    public boolean isSuperAdmin(Long userId) {
        if (userId == null) return false;
        User u = userMapper.selectById(userId);
        return u != null
                && "SUPER_ADMIN".equals(u.getPlatformRole())
                && "ACTIVE".equals(u.getStatus());
    }

    /** 推荐入口：PAT 凭据直接返回 false。 */
    public boolean isSuperAdmin(CurrentUser cu) {
        if (cu == null || cu.isPat()) return false;
        return isSuperAdmin(cu.getId());
    }

    /** 从 SecurityContext 取当前用户判定，便于不持有 CurrentUser 的地方使用。 */
    public boolean currentIsSuperAdmin() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !(a.getPrincipal() instanceof CurrentUser cu)) return false;
        return isSuperAdmin(cu);
    }

    /**
     * 构造一条"虚拟"的 TeamMember，用于让 SUPER_ADMIN 在团队上下文里"出现"为 ADMIN。
     *
     * <p>下游代码常用 {@code member.getRole()} 决定 UI 与行为；虚拟成员给出 {@code ADMIN}
     * 角色，避开 {@code OWNER} 专属语义（最后 owner 守卫、转让 owner 限制等）。</p>
     */
    public static TeamMember virtualSuperAdmin(Long teamId, Long userId) {
        TeamMember m = new TeamMember();
        m.setTeamId(teamId);
        m.setUserId(userId);
        m.setRole("ADMIN");
        m.setSkillsCount(0);
        m.setJoinedAt(LocalDateTime.now());
        return m;
    }
}
