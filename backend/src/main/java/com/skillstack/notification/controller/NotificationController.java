package com.skillstack.notification.controller;

import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.common.web.PageResult;
import com.skillstack.notification.dto.NotificationItem;
import com.skillstack.notification.dto.NotificationQuery;
import com.skillstack.notification.dto.NotificationReadAllRes;
import com.skillstack.notification.dto.NotificationUnreadCountRes;
import com.skillstack.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/me/notifications")
public class NotificationController {

    private final NotificationService service;
    private final TeamAccessGuard guard;

    @GetMapping
    public ApiResponse<PageResult<NotificationItem>> list(
            @ModelAttribute NotificationQuery q,
            @AuthenticationPrincipal CurrentUser me) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        return ApiResponse.ok(service.listMine(uid, q));
    }

    @GetMapping("/unread-count")
    public ApiResponse<NotificationUnreadCountRes> unreadCount(
            @RequestParam(value = "teamId", required = false) Long teamId,
            @AuthenticationPrincipal CurrentUser me) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        return ApiResponse.ok(new NotificationUnreadCountRes(service.unreadCount(uid, teamId)));
    }

    @PostMapping("/{id}/read")
    public ApiResponse<Void> markRead(@PathVariable Long id,
                                      @AuthenticationPrincipal CurrentUser me) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        service.markRead(uid, id);
        return ApiResponse.ok();
    }

    @PostMapping("/read-all")
    public ApiResponse<NotificationReadAllRes> markAllRead(@RequestParam(value = "teamId", required = false) Long teamId,
                                                           @AuthenticationPrincipal CurrentUser me) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        return ApiResponse.ok(new NotificationReadAllRes(service.markAllRead(uid, teamId)));
    }
}
