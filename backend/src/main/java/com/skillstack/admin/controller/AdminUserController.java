package com.skillstack.admin.controller;

import com.skillstack.admin.dto.AdminUserDetailVO;
import com.skillstack.admin.dto.AdminUserListItemVO;
import com.skillstack.admin.security.RequireSuperAdmin;
import com.skillstack.admin.service.AdminUserService;
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

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequireSuperAdmin
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final AdminUserService adminUserService;
    private final AuditLogService auditLogService;

    @GetMapping
    public ApiResponse<PageResult<AdminUserListItemVO>> list(
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "platformRole", required = false) String platformRole,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "page", defaultValue = "1") long page,
            @RequestParam(value = "size", defaultValue = "20") long size) {
        return ApiResponse.ok(adminUserService.list(q, platformRole, status, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminUserDetailVO> detail(@PathVariable("id") Long id) {
        return ApiResponse.ok(adminUserService.detail(id));
    }

    @PostMapping("/{id}/disable")
    public ApiResponse<Void> disable(@PathVariable("id") Long id,
                                     @AuthenticationPrincipal CurrentUser me) {
        Long actorId = requireActor(me);
        Map<String, Object> payload = adminUserService.disable(actorId, id);
        auditLogService.record(actorId, "user.disable", "user", id, payload);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/enable")
    public ApiResponse<Void> enable(@PathVariable("id") Long id,
                                    @AuthenticationPrincipal CurrentUser me) {
        Long actorId = requireActor(me);
        Map<String, Object> payload = adminUserService.enable(id);
        auditLogService.record(actorId, "user.enable", "user", id, payload);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/reset-password")
    public ApiResponse<Map<String, Object>> resetPassword(@PathVariable("id") Long id,
                                                          @AuthenticationPrincipal CurrentUser me) {
        Long actorId = requireActor(me);
        AdminUserService.ResetPasswordResult r = adminUserService.resetPassword(id);

        Map<String, Object> auditPayload = new LinkedHashMap<>();
        auditPayload.put("userId", r.userId());
        auditPayload.put("handle", r.handle());
        // 仅记录"重置发生过"，绝不存明文密码
        auditLogService.record(actorId, "user.reset_password", "user", id, auditPayload);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("tempPassword", r.tempPassword());
        return ApiResponse.ok(body);
    }

    @PostMapping("/{id}/promote")
    public ApiResponse<Void> promote(@PathVariable("id") Long id,
                                     @AuthenticationPrincipal CurrentUser me) {
        Long actorId = requireActor(me);
        Map<String, Object> payload = adminUserService.promote(id);
        auditLogService.record(actorId, "user.promote", "user", id, payload);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/demote")
    public ApiResponse<Void> demote(@PathVariable("id") Long id,
                                    @AuthenticationPrincipal CurrentUser me) {
        Long actorId = requireActor(me);
        Map<String, Object> payload = adminUserService.demote(actorId, id);
        auditLogService.record(actorId, "user.demote", "user", id, payload);
        return ApiResponse.ok();
    }

    private Long requireActor(CurrentUser me) {
        if (me == null || me.getId() == null) {
            throw new BusinessException(40100, "未登录");
        }
        return me.getId();
    }
}
