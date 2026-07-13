package com.skillstack.admin.controller;

import com.skillstack.admin.dto.AdminAddTeamMemberReq;
import com.skillstack.admin.dto.AdminUpdateTeamMemberRoleReq;
import com.skillstack.admin.security.RequireSuperAdmin;
import com.skillstack.admin.service.AuditLogService;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.common.web.PageQuery;
import com.skillstack.common.web.PageResult;
import com.skillstack.team.dto.TeamMemberRes;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.service.TeamMemberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequireSuperAdmin
@RequestMapping("/api/admin/teams/{teamId}/members")
public class AdminTeamMemberController {

    private final TeamMemberService teamMemberService;
    private final AuditLogService auditLogService;

    @GetMapping
    public ApiResponse<PageResult<TeamMemberRes>> list(@PathVariable Long teamId,
                                                       @RequestParam(required = false) String role,
                                                       @RequestParam(required = false) String q,
                                                       PageQuery pq,
                                                       @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(teamMemberService.page(teamId, role, q, pq, requireActor(me)));
    }

    @PostMapping
    public ApiResponse<Void> add(@PathVariable Long teamId,
                                 @Valid @RequestBody AdminAddTeamMemberReq req,
                                 @AuthenticationPrincipal CurrentUser me) {
        Long actor = requireActor(me);
        TeamMember m = teamMemberService.addMember(teamId, req.getUserId(), req.getRole());
        Map<String, Object> payload = payload(teamId, req.getUserId(), null, req.getRole());
        payload.put("memberId", m.getId());
        auditLogService.record(actor, "team_member.add", "team_member", m.getId(), payload);
        return ApiResponse.ok();
    }

    @PutMapping("/{userId}")
    public ApiResponse<Void> updateRole(@PathVariable Long teamId,
                                        @PathVariable Long userId,
                                        @Valid @RequestBody AdminUpdateTeamMemberRoleReq req,
                                        @AuthenticationPrincipal CurrentUser me) {
        Long actor = requireActor(me);
        // 先查旧角色用于 audit
        String oldRole = teamMemberService.page(teamId, null, null,
                new PageQuery(), actor).getItems().stream()
                .filter(it -> userId.equals(it.getUserId()))
                .map(TeamMemberRes::getRole).findFirst().orElse(null);
        teamMemberService.internalUpdateRole(teamId, userId, req.getRole(), actor);
        auditLogService.record(actor, "team_member.role_change", "team_member", userId,
                payload(teamId, userId, oldRole, req.getRole()));
        return ApiResponse.ok();
    }

    @DeleteMapping("/{userId}")
    public ApiResponse<Void> remove(@PathVariable Long teamId,
                                    @PathVariable Long userId,
                                    @AuthenticationPrincipal CurrentUser me) {
        Long actor = requireActor(me);
        teamMemberService.internalRemove(teamId, userId, actor);
        auditLogService.record(actor, "team_member.remove", "team_member", userId,
                payload(teamId, userId, null, null));
        return ApiResponse.ok();
    }

    private Long requireActor(CurrentUser me) {
        if (me == null || me.getId() == null) {
            throw new BusinessException(40100, "未登录");
        }
        return me.getId();
    }

    private static Map<String, Object> payload(Long teamId, Long userId, Object oldRole, Object newRole) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("teamId", teamId);
        p.put("userId", userId);
        if (oldRole != null) p.put("oldRole", oldRole);
        if (newRole != null) p.put("newRole", newRole);
        return p;
    }
}
