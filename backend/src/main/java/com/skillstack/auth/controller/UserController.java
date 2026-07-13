package com.skillstack.auth.controller;

import com.skillstack.auth.dto.ChangePasswordReq;
import com.skillstack.auth.dto.ChangePhoneReq;
import com.skillstack.auth.dto.MeRes;
import com.skillstack.auth.dto.UpdateMeProfileReq;
import com.skillstack.auth.service.AuthService;
import com.skillstack.auth.service.UserService;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final AuthService authService;

    @GetMapping("/api/users/{handle}")
    public ApiResponse<Map<String, Object>> profile(@PathVariable String handle) {
        return ApiResponse.ok(userService.buildPublicProfile(handle));
    }

    @PutMapping("/api/me/profile")
    public ApiResponse<MeRes> updateProfile(
            @AuthenticationPrincipal CurrentUser me,
            @Valid @RequestBody UpdateMeProfileReq req
    ) {
        requireLogin(me);
        return ApiResponse.ok(userService.updateProfile(me.getId(), req));
    }

    @PutMapping("/api/me/password")
    public ApiResponse<Void> changePassword(
            @AuthenticationPrincipal CurrentUser me,
            @Valid @RequestBody ChangePasswordReq req
    ) {
        requireLogin(me);
        userService.changePassword(me.getId(), req);
        return ApiResponse.ok(null);
    }

    @PutMapping("/api/me/phone")
    public ApiResponse<MeRes> changePhone(
            @AuthenticationPrincipal CurrentUser me,
            @Valid @RequestBody ChangePhoneReq req
    ) {
        requireLogin(me);
        return ApiResponse.ok(userService.changePhone(
                me.getId(),
                req,
                authService::verifySmsCodeForAccountChange
        ));
    }

    @PostMapping("/api/me/avatar")
    public ApiResponse<Map<String, String>> uploadAvatar(
            @AuthenticationPrincipal CurrentUser me,
            @RequestParam("file") MultipartFile file
    ) {
        requireLogin(me);
        String url = userService.uploadAvatar(me.getId(), file);
        return ApiResponse.ok(Map.of("avatarUrl", url));
    }

    private void requireLogin(CurrentUser me) {
        if (me == null) {
            throw new BusinessException(40100, "未登录");
        }
    }
}
