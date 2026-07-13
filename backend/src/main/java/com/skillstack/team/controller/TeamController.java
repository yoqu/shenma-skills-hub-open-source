package com.skillstack.team.controller;

import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.team.dto.CreateTeamReq;
import com.skillstack.team.dto.JoinByCodeReq;
import com.skillstack.team.dto.MyTeamItem;
import com.skillstack.team.dto.TeamDetailRes;
import com.skillstack.team.dto.TeamSettingsReq;
import com.skillstack.team.service.InviteService;
import com.skillstack.team.service.TeamMemberService;
import com.skillstack.team.service.TeamService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamController {

    private final TeamService teamService;
    private final InviteService inviteService;
    private final TeamMemberService teamMemberService;

    /** 创建团队，调用者自动成为 OWNER。 */
    @PostMapping
    public ApiResponse<TeamDetailRes> create(@AuthenticationPrincipal CurrentUser me,
                                              @Valid @RequestBody CreateTeamReq req) {
        return ApiResponse.ok(teamService.createTeam(me.getId(), req.getName(), req.getSlug()));
    }

    /** 当前用户加入的团队列表（header 切换器）。 */
    @GetMapping("/mine")
    public ApiResponse<List<MyTeamItem>> mine(@AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(teamService.listMyTeams(me.getId()));
    }

    /** 首页公开团队列表。 */
    @GetMapping
    public ApiResponse<List<TeamDetailRes>> listPublic() {
        return ApiResponse.ok(teamService.listPublicTeams());
    }

    /**
     * 团队公开主页。GET /api/teams/{slug} 已在 SecurityConfig 放行。
     * 未开启 publicHome 的团队对外不可见。
     */
    @GetMapping("/{slug}")
    public ApiResponse<TeamDetailRes> bySlug(@PathVariable String slug) {
        return ApiResponse.ok(teamService.getPublicBySlug(slug));
    }

    /** 团队详情（任意成员可访问，不要求 publicHome）。 */
    @GetMapping("/{teamId}/detail")
    public ApiResponse<TeamDetailRes> getMemberDetail(@PathVariable Long teamId,
                                                      @AuthenticationPrincipal CurrentUser me) {
        teamService.requireMembership(teamId, me.getId());
        return ApiResponse.ok(teamService.getById(teamId));
    }

    /** 团队设置（需要 ADMIN/OWNER）。 */
    @GetMapping("/{teamId}/settings")
    public ApiResponse<TeamDetailRes> getSettings(@PathVariable Long teamId,
                                                  @AuthenticationPrincipal CurrentUser me) {
        teamService.requireWriter(teamId, me.getId());
        return ApiResponse.ok(teamService.getById(teamId));
    }

    @PutMapping("/{teamId}/settings")
    public ApiResponse<TeamDetailRes> updateSettings(@PathVariable Long teamId,
                                                     @AuthenticationPrincipal CurrentUser me,
                                                     @Valid @RequestBody TeamSettingsReq req) {
        return ApiResponse.ok(teamService.updateSettings(teamId, me.getId(), req));
    }

    @PostMapping("/{teamId}/logo")
    public ApiResponse<Map<String, String>> uploadLogo(@PathVariable Long teamId,
                                                       @AuthenticationPrincipal CurrentUser me,
                                                       @RequestParam("file") MultipartFile file) {
        String url = teamService.uploadLogo(teamId, me.getId(), file);
        return ApiResponse.ok(Map.of("logoUrl", url));
    }

    /** 用邀请码加入团队。 */
    @PostMapping("/join-by-code")
    public ApiResponse<Map<String, Object>> joinByCode(@AuthenticationPrincipal CurrentUser me,
                                                       @Valid @RequestBody JoinByCodeReq req) {
        Long teamId = inviteService.joinByCode(req.getCode(), me.getId());
        TeamDetailRes detail = teamService.getById(teamId);
        return ApiResponse.ok(Map.of("teamId", teamId, "team", detail));
    }

    /**
     * 当前用户离开指定团队。
     * 唯一 Owner 不允许离开，会以 40300 / T_LAST_OWNER 拒绝。
     * 离队同时会吊销该用户在本团队下的全部 PAT（在 service 中级联处理）。
     */
    @PostMapping("/{teamId}/leave")
    public ApiResponse<Void> leaveSelf(@PathVariable Long teamId,
                                       @AuthenticationPrincipal CurrentUser me) {
        teamMemberService.leave(teamId, me.getId());
        return ApiResponse.ok(null);
    }
}
