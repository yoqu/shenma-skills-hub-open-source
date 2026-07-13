package com.skillstack.team.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.web.PageQuery;
import com.skillstack.common.web.PageResult;
import com.skillstack.team.dto.TeamMemberRes;
import com.skillstack.team.dto.UpdateMemberReq;
import com.skillstack.team.entity.Team;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.notification.service.NotificationService;
import com.skillstack.notification.service.NotificationType;
import com.skillstack.team.mapper.TeamMemberMapper;
import com.skillstack.skill.mapper.SkillMapper;
import com.skillstack.token.service.PersonalAccessTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TeamMemberService {

    private final TeamMapper teamMapper;
    private final TeamMemberMapper teamMemberMapper;
    private final TeamService teamService;
    private final PersonalAccessTokenService patService;
    private final com.skillstack.common.security.PermissionService permissionService;
    private final SkillMapper skillMapper;

    @Lazy
    @Autowired
    private NotificationService notificationService;

    public PageResult<TeamMemberRes> page(Long teamId, String role, String q, PageQuery pq, Long currentUserId) {
        Team team = teamService.requireTeam(teamId);
        if (!Boolean.TRUE.equals(team.getPublicHome())
                && !isMember(teamId, currentUserId)
                && !permissionService.isSuperAdmin(currentUserId)) {
            throw new BusinessException(40400, "团队不存在");
        }
        List<TeamMemberRes> items = teamMapper.selectMembers(teamId, role, q, pq.getOffset(), pq.getSize());
        long total = teamMapper.countMembers(teamId, role, q);
        fillSkillsCount(teamId, items);
        return PageResult.of(items, total, pq.getPage(), pq.getSize());
    }

    /**
     * 用 SkillMapper 批量按作者统计当前页成员的 skill 数并回填。
     *
     * <p>原本 {@code TeamMapper.selectMembers} 读 {@code team_members.skills_count} 静态冗余列，
     * 但全代码库没有写路径在 skill 发布时维护这一列，导致成员列表 skill 数永远是 0。
     * 与 {@link TeamService} 中 liveSkillCounts 同源，按 deleted=0 实时聚合，不过滤状态，
     * 这样作者一旦发布（即便还在 PENDING）成员列表也立即反映。</p>
     */
    private void fillSkillsCount(Long teamId, List<TeamMemberRes> items) {
        if (items == null || items.isEmpty()) return;
        List<Long> authorIds = items.stream()
                .map(TeamMemberRes::getUserId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (authorIds.isEmpty()) return;
        Map<Long, Integer> counts = new HashMap<>();
        for (Map<String, Object> row : skillMapper.countByTeamAndAuthors(teamId, authorIds)) {
            Object aid = row.get("authorId");
            Object cnt = row.get("cnt");
            if (aid instanceof Number && cnt instanceof Number) {
                counts.put(((Number) aid).longValue(), ((Number) cnt).intValue());
            }
        }
        for (TeamMemberRes it : items) {
            it.setSkills(counts.getOrDefault(it.getUserId(), 0));
        }
    }

    @Transactional
    public void updateRole(Long teamId, Long targetUserId, Long operatorId, UpdateMemberReq req) {
        teamService.requireWriter(teamId, operatorId);
        String role = req.getRole() == null ? null : req.getRole().trim().toUpperCase();
        if (!TeamService.isValidRole(role)) {
            throw new BusinessException(40001, "非法角色：" + role);
        }
        internalUpdateRole(teamId, targetUserId, role, operatorId);
    }

    /**
     * 不做调用方权限校验的角色变更。供 admin 端复用。
     * 调用方负责：1) 鉴权（必须是 Writer 或超管），2) role 标准化与合法性校验。
     * 保留 Owner 保护：不能修改 Owner，不能升为 Owner。
     */
    @Transactional
    public void internalUpdateRole(Long teamId, Long targetUserId, String role, Long operatorId) {
        TeamMember target = findMember(teamId, targetUserId);
        if ("OWNER".equals(target.getRole())) {
            throw new BusinessException(40300, "T_FORBIDDEN: 不能修改 Owner");
        }
        if ("OWNER".equals(role)) {
            throw new BusinessException(40300, "T_FORBIDDEN: 不能在此处转让 Owner");
        }
        target.setRole(role);
        teamMemberMapper.updateById(target);
        com.skillstack.team.entity.Team team = teamService.requireTeam(teamId);
        notificationService.notify(NotificationType.TEAM_ROLE_CHANGED, targetUserId, teamId, operatorId,
                "你在 " + team.getName() + " 的角色已变更为 " + role,
                null, "/team", "team_member", target.getId());
    }

    @Transactional
    public void remove(Long teamId, Long targetUserId, Long operatorId) {
        teamService.requireWriter(teamId, operatorId);
        internalRemove(teamId, targetUserId, operatorId);
    }

    /**
     * 不做调用方权限校验的移除。供 admin 端复用。
     * 调用方负责鉴权。保留 Owner 保护：不能移除 Owner。
     */
    @Transactional
    public void internalRemove(Long teamId, Long targetUserId, Long operatorId) {
        TeamMember target = findMember(teamId, targetUserId);
        if ("OWNER".equals(target.getRole())) {
            throw new BusinessException(40300, "T_FORBIDDEN: 不能移除 Owner");
        }
        teamMemberMapper.deleteById(target.getId());
        Team t = teamService.requireTeam(teamId);
        if (t.getMembersCount() != null && t.getMembersCount() > 0) {
            t.setMembersCount(t.getMembersCount() - 1);
            teamMapper.updateById(t);
        }
        notificationService.notify(NotificationType.TEAM_REMOVED, targetUserId, teamId, operatorId,
                "你已从团队 " + t.getName() + " 中移除",
                null, "/", "team_member", target.getId());
    }

    @Transactional
    public void leave(Long teamId, Long userId) {
        Team t = teamService.requireTeam(teamId);
        TeamMember self = findMember(teamId, userId);
        if ("OWNER".equals(self.getRole())) {
            long ownerCount = teamMemberMapper.selectCount(new LambdaQueryWrapper<TeamMember>()
                    .eq(TeamMember::getTeamId, teamId)
                    .eq(TeamMember::getRole, "OWNER"));
            if (ownerCount <= 1) {
                throw new BusinessException(40300, "T_LAST_OWNER: 你是唯一 Owner，无法离队。请先转让所有权");
            }
        }
        teamMemberMapper.deleteById(self.getId());
        if (t.getMembersCount() != null && t.getMembersCount() > 0) {
            t.setMembersCount(t.getMembersCount() - 1);
            teamMapper.updateById(t);
        }
        patService.revokeAllForUserInTeam(teamId, userId);
    }

    public boolean isMember(Long teamId, Long userId) {
        if (teamId == null || userId == null) return false;
        TeamMember exists = teamMemberMapper.selectOne(new LambdaQueryWrapper<TeamMember>()
                .eq(TeamMember::getTeamId, teamId)
                .eq(TeamMember::getUserId, userId));
        return exists != null;
    }

    @Transactional
    public TeamMember addMember(Long teamId, Long userId, String role) {
        TeamMember exists = teamMemberMapper.selectOne(new LambdaQueryWrapper<TeamMember>()
                .eq(TeamMember::getTeamId, teamId)
                .eq(TeamMember::getUserId, userId));
        if (exists != null) {
            return exists;
        }
        TeamMember m = new TeamMember();
        m.setTeamId(teamId);
        m.setUserId(userId);
        m.setRole(role);
        m.setSkillsCount(0);
        m.setLastActiveLabel("刚刚");
        teamMemberMapper.insert(m);
        Team t = teamService.requireTeam(teamId);
        t.setMembersCount((t.getMembersCount() == null ? 0 : t.getMembersCount()) + 1);
        teamMapper.updateById(t);
        return m;
    }

    private TeamMember findMember(Long teamId, Long userId) {
        TeamMember m = teamMemberMapper.selectOne(new LambdaQueryWrapper<TeamMember>()
                .eq(TeamMember::getTeamId, teamId)
                .eq(TeamMember::getUserId, userId));
        if (m == null) {
            throw new BusinessException(40400, "成员不存在");
        }
        return m;
    }
}
