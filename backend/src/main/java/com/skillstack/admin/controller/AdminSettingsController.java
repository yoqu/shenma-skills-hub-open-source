package com.skillstack.admin.controller;

import com.skillstack.admin.dto.BrandingVO;
import com.skillstack.admin.dto.SiteSettingVO;
import com.skillstack.admin.dto.UpdateSettingsReq;
import com.skillstack.admin.security.RequireSuperAdmin;
import com.skillstack.admin.service.AuditLogService;
import com.skillstack.admin.service.SiteSettingsService;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class AdminSettingsController {

    private final SiteSettingsService settingsService;
    private final AuditLogService auditLogService;

    /** 公开：前端启动时拉取站点品牌，无需登录。 */
    @GetMapping("/api/site/branding")
    public ApiResponse<BrandingVO> branding() {
        return ApiResponse.ok(settingsService.branding());
    }

    @RequireSuperAdmin
    @GetMapping("/api/admin/settings")
    public ApiResponse<List<SiteSettingVO>> list() {
        return ApiResponse.ok(settingsService.listAll());
    }

    @RequireSuperAdmin
    @PutMapping("/api/admin/settings")
    public ApiResponse<Map<String, Object>> update(@RequestBody UpdateSettingsReq req,
                                                   @AuthenticationPrincipal CurrentUser me) {
        if (me == null) throw new BusinessException(40100, "未登录");
        SiteSettingsService.UpdateResult result = settingsService.update(req.getValues(), me.getId());
        if (!result.appliedKeys().isEmpty()) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("keys", result.appliedKeys());
            auditLogService.record(me.getId(), "settings.update", "site_settings", null, payload);
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("appliedKeys", result.appliedKeys());
        body.put("unknownKeys", result.unknownKeys());
        body.put("branding", settingsService.branding());
        return ApiResponse.ok(body);
    }

    @RequireSuperAdmin
    @PostMapping("/api/admin/settings/logo")
    public ApiResponse<BrandingVO> uploadLogo(@RequestParam("file") MultipartFile file,
                                              @AuthenticationPrincipal CurrentUser me) {
        if (me == null) throw new BusinessException(40100, "未登录");
        BrandingVO branding = settingsService.uploadLogo(file, me.getId());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("logoUrl", branding.getLogoUrl());
        auditLogService.record(me.getId(), "settings.logo_upload", "site_settings", null, payload);
        return ApiResponse.ok(branding);
    }
}
