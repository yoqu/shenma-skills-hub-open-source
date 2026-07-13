package com.skillstack.admin.controller;

import com.skillstack.admin.security.RequireSuperAdmin;
import com.skillstack.auth.sms.SmsProviderService;
import com.skillstack.auth.sms.dto.AdminSmsProviderVO;
import com.skillstack.auth.sms.dto.UpdateSmsProviderReq;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class AdminSmsProviderController {

    private final SmsProviderService smsProviderService;


    @RequireSuperAdmin
    @GetMapping("/api/admin/sms-provider")
    public ApiResponse<AdminSmsProviderVO> get() {
        return ApiResponse.ok(smsProviderService.getAdmin());
    }

    @RequireSuperAdmin
    @PutMapping("/api/admin/sms-provider")
    public ApiResponse<AdminSmsProviderVO> update(@RequestBody UpdateSmsProviderReq req,
                                                  @AuthenticationPrincipal CurrentUser me) {
        if (me == null) throw new BusinessException(40100, "未登录");
        return ApiResponse.ok(smsProviderService.update(req, me.getId()));
    }
}
