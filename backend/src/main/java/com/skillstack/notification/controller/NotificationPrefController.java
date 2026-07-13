package com.skillstack.notification.controller;

import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.notification.dto.NotificationPrefRes;
import com.skillstack.notification.dto.UpdateNotificationPrefsReq;
import com.skillstack.notification.service.NotificationPrefService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/teams/{teamId}/me/notification-prefs")
public class NotificationPrefController {

    private final NotificationPrefService service;
    private final TeamAccessGuard guard;

    @GetMapping
    public ApiResponse<NotificationPrefRes> get(@PathVariable Long teamId,
                                                @AuthenticationPrincipal CurrentUser me) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        return ApiResponse.ok(service.get(teamId, uid));
    }

    @PutMapping
    public ApiResponse<NotificationPrefRes> update(@PathVariable Long teamId,
                                                   @AuthenticationPrincipal CurrentUser me,
                                                   @Valid @RequestBody UpdateNotificationPrefsReq req) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        return ApiResponse.ok(service.update(teamId, uid, req));
    }
}
