package com.skillstack.admin.controller;

import com.skillstack.admin.dto.AdminSkillListItemVO;
import com.skillstack.admin.security.RequireSuperAdmin;
import com.skillstack.admin.service.AdminSkillService;
import com.skillstack.admin.service.AuditLogService;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.common.web.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequireSuperAdmin
@RequestMapping("/api/admin/skills")
public class AdminSkillController {

    private final AdminSkillService adminSkillService;
    private final AuditLogService auditLogService;

    @GetMapping
    public ApiResponse<PageResult<AdminSkillListItemVO>> list(
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "teamId", required = false) Long teamId,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "visibility", required = false) String visibility,
            @RequestParam(value = "page", defaultValue = "1") long page,
            @RequestParam(value = "size", defaultValue = "20") long size) {
        return ApiResponse.ok(adminSkillService.list(q, teamId, status, visibility, page, size));
    }

    @PostMapping("/{id}/unpublish")
    public ApiResponse<Void> unpublish(@PathVariable("id") Long id,
                                       @AuthenticationPrincipal CurrentUser me) {
        Long actorId = requireActor(me);
        Map<String, Object> payload = adminSkillService.unpublish(id);
        auditLogService.record(actorId, "skill.unpublish", "skill", id, payload);
        return ApiResponse.ok();
    }

    private Long requireActor(CurrentUser me) {
        if (me == null || me.getId() == null) {
            throw new BusinessException(40100, "未登录");
        }
        return me.getId();
    }
}
