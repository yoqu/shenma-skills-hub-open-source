package com.skillstack.admin.controller;

import com.skillstack.admin.dto.AdminTeamDetailVO;
import com.skillstack.admin.dto.AdminTeamListItemVO;
import com.skillstack.admin.dto.AdminUpdateTeamReq;
import com.skillstack.admin.security.RequireSuperAdmin;
import com.skillstack.admin.service.AdminTeamService;
import com.skillstack.admin.service.AuditLogService;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.common.web.PageResult;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequireSuperAdmin
@RequestMapping("/api/admin/teams")
public class AdminTeamController {

    private final AdminTeamService adminTeamService;
    private final AuditLogService auditLogService;

    @GetMapping
    public ApiResponse<PageResult<AdminTeamListItemVO>> list(
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "page", defaultValue = "1") long page,
            @RequestParam(value = "size", defaultValue = "20") long size) {
        return ApiResponse.ok(adminTeamService.list(q, status, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminTeamDetailVO> detail(@PathVariable("id") Long id) {
        return ApiResponse.ok(adminTeamService.detail(id));
    }

    @PostMapping("/{id}/disable")
    public ApiResponse<Void> disable(@PathVariable("id") Long id,
                                     @AuthenticationPrincipal CurrentUser me) {
        Long actorId = requireActor(me);
        Map<String, Object> payload = adminTeamService.disable(id);
        auditLogService.record(actorId, "team.disable", "team", id, payload);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/enable")
    public ApiResponse<Void> enable(@PathVariable("id") Long id,
                                    @AuthenticationPrincipal CurrentUser me) {
        Long actorId = requireActor(me);
        Map<String, Object> payload = adminTeamService.enable(id);
        auditLogService.record(actorId, "team.enable", "team", id, payload);
        return ApiResponse.ok();
    }

    @PatchMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable("id") Long id,
                                    @Valid @RequestBody AdminUpdateTeamReq req,
                                    @AuthenticationPrincipal CurrentUser me) {
        Long actor = requireActor(me);
        if (req.getName() != null || req.getSlug() != null) {
            Map<String, Object> changes = adminTeamService.updateBasic(id, req.getName(), req.getSlug());
            if (changes.size() > 1) { // 不止 teamId
                auditLogService.record(actor, "team.update_basic", "team", id, changes);
            }
        }
        if (req.getStatus() != null) {
            if ("DISABLED".equals(req.getStatus())) {
                Map<String, Object> payload = adminTeamService.disable(id);
                auditLogService.record(actor, "team.disable", "team", id, payload);
            } else if ("ACTIVE".equals(req.getStatus())) {
                Map<String, Object> payload = adminTeamService.enable(id);
                auditLogService.record(actor, "team.enable", "team", id, payload);
            }
        }
        return ApiResponse.ok();
    }

    private Long requireActor(CurrentUser me) {
        if (me == null || me.getId() == null) {
            throw new BusinessException(40100, "未登录");
        }
        return me.getId();
    }
}
