package com.skillstack.activity.controller;

import com.skillstack.activity.dto.ActivityItem;
import com.skillstack.activity.service.ActivityService;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.web.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ActivityController {

    private final ActivityService activityService;
    private final TeamAccessGuard guard;

    /** 仅 admin/owner 才看得到的 activity kind（TEAM-ACT-003）。 */
    private static final Set<String> ADMIN_ONLY_KINDS = Set.of("invite", "unlist", "reject");

    /**
     * 团队活动流（按时间倒序）— 必须是团队成员才能读（TEAM-ACT-002）。
     * member/viewer 看到的列表会过滤掉 admin-only 事件。
     */
    @GetMapping("/teams/{teamId}/activity")
    public ApiResponse<List<ActivityItem>> listByTeam(
            @PathVariable Long teamId,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal CurrentUser me) {
        var member = guard.requireMember(teamId, me == null ? null : me.getId());
        List<ActivityItem> items = activityService.listByTeam(teamId, limit);
        boolean isWriter = "OWNER".equals(member.getRole()) || "ADMIN".equals(member.getRole());
        if (!isWriter) {
            items = items.stream()
                    .filter(it -> !ADMIN_ONLY_KINDS.contains(it.getKind()))
                    .toList();
        }
        return ApiResponse.ok(items);
    }
}
