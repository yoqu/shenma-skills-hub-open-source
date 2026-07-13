package com.skillstack.team.controller;

import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.common.web.PageQuery;
import com.skillstack.common.web.PageResult;
import com.skillstack.team.dto.TeamMemberRes;
import com.skillstack.team.dto.UpdateMemberReq;
import com.skillstack.team.service.TeamMemberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/teams/{teamId}/members")
@RequiredArgsConstructor
public class TeamMemberController {

    private final TeamMemberService teamMemberService;
    private final TeamAccessGuard guard;

    /**
     * 团队成员列表。
     *
     * 公开（公共团队页贡献者展示）返回基础字段（handle/name/avatar/role/joined）；
     * 团队成员/Writer 接口口径相同，避免敏感字段在 DTO 中泄露 — TeamMemberRes 不含 email/phone。
     *
     * 写操作（PUT/DELETE）仍然要求 Writer。
     */
    @GetMapping
    public ApiResponse<PageResult<TeamMemberRes>> list(@PathVariable Long teamId,
                                                       @RequestParam(required = false) String role,
                                                       @RequestParam(required = false) String q,
                                                       PageQuery pq,
                                                       @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        return ApiResponse.ok(teamMemberService.page(teamId, role, q, pq, uid));
    }

    @PutMapping("/{userId}")
    public ApiResponse<Void> updateRole(@PathVariable Long teamId,
                                        @PathVariable Long userId,
                                        @AuthenticationPrincipal CurrentUser me,
                                        @Valid @RequestBody UpdateMemberReq req) {
        teamMemberService.updateRole(teamId, userId, me.getId(), req);
        return ApiResponse.ok();
    }

    @DeleteMapping("/{userId}")
    public ApiResponse<Void> remove(@PathVariable Long teamId,
                                    @PathVariable Long userId,
                                    @AuthenticationPrincipal CurrentUser me) {
        teamMemberService.remove(teamId, userId, me.getId());
        return ApiResponse.ok();
    }
}
