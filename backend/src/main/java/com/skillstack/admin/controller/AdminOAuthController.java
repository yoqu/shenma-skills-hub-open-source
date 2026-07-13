package com.skillstack.admin.controller;

import com.skillstack.admin.security.RequireSuperAdmin;
import com.skillstack.auth.oauth.dto.AdminProviderVO;
import com.skillstack.auth.oauth.dto.UpdateProviderReq;
import com.skillstack.auth.oauth.service.OAuthProviderService;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class AdminOAuthController {

    private final OAuthProviderService providerService;

    @RequireSuperAdmin
    @GetMapping("/api/admin/oauth-providers")
    public ApiResponse<List<AdminProviderVO>> list() {
        return ApiResponse.ok(providerService.listAdmin());
    }

    @RequireSuperAdmin
    @GetMapping("/api/admin/oauth-providers/{code}")
    public ApiResponse<AdminProviderVO> get(@PathVariable String code) {
        return ApiResponse.ok(providerService.getAdmin(code));
    }

    @RequireSuperAdmin
    @PutMapping("/api/admin/oauth-providers/{code}")
    public ApiResponse<AdminProviderVO> update(@PathVariable String code,
                                               @RequestBody UpdateProviderReq req,
                                               @AuthenticationPrincipal CurrentUser me) {
        if (me == null) throw new BusinessException(40100, "未登录");
        return ApiResponse.ok(providerService.update(code, req, me.getId()));
    }
}
