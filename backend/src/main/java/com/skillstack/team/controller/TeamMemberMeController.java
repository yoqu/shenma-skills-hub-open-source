package com.skillstack.team.controller;

import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.team.dto.TeamMemberProfileRes;
import com.skillstack.team.dto.UpdateTeamMemberProfileReq;
import com.skillstack.team.service.TeamMemberProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 当前用户在指定团队的偏好资料相关端点。
 * 路径前缀 /api/teams/{teamId}/me/... 由 SecurityConfig 的 authenticated() 和 TeamAccessGuard 守护。
 */
@RestController
@RequestMapping("/api/teams/{teamId}/me")
@RequiredArgsConstructor
public class TeamMemberMeController {

    private final TeamMemberProfileService teamMemberProfileService;
    private final TeamAccessGuard guard;

    /**
     * GET /api/teams/{teamId}/me/profile
     * 获取当前用户在指定团队的偏好资料。
     */
    @GetMapping("/profile")
    public ApiResponse<TeamMemberProfileRes> getMyTeamProfile(
            @PathVariable Long teamId,
            @AuthenticationPrincipal CurrentUser me
    ) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        return ApiResponse.ok(teamMemberProfileService.get(teamId, uid, uid));
    }

    /**
     * PUT /api/teams/{teamId}/me/profile
     * 更新当前用户在指定团队的偏好资料。
     */
    @PutMapping("/profile")
    public ApiResponse<TeamMemberProfileRes> updateMyTeamProfile(
            @PathVariable Long teamId,
            @AuthenticationPrincipal CurrentUser me,
            @Valid @RequestBody UpdateTeamMemberProfileReq req
    ) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        return ApiResponse.ok(teamMemberProfileService.update(teamId, uid, req));
    }
}
