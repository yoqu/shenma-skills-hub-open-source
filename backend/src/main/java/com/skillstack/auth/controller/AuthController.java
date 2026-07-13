package com.skillstack.auth.controller;

import com.skillstack.auth.dto.CliDeviceApproveReq;
import com.skillstack.auth.dto.CliDeviceInitRes;
import com.skillstack.auth.dto.CliDeviceLookupRes;
import com.skillstack.auth.dto.CliDevicePollReq;
import com.skillstack.auth.dto.CliDevicePollRes;
import com.skillstack.auth.dto.CliWebInfoRes;
import com.skillstack.auth.dto.LoginReq;
import com.skillstack.auth.dto.LoginRes;
import com.skillstack.auth.dto.MeRes;
import com.skillstack.auth.dto.RegisterStep1Req;
import com.skillstack.auth.dto.RegisterStep2Req;
import com.skillstack.auth.dto.RegisterStep3Req;
import com.skillstack.auth.dto.RegisterStep4Req;
import com.skillstack.auth.dto.SmsCodeReq;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.auth.oauth.dto.AuthUrlVO;
import com.skillstack.auth.oauth.dto.PublicProviderVO;
import com.skillstack.auth.oauth.service.OAuthProviderService;
import com.skillstack.auth.oauth.service.OAuthService;
import com.skillstack.auth.service.AuthService;
import com.skillstack.auth.service.CliDeviceAuthService;
import com.skillstack.auth.service.UserService;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.team.dto.MyPhoneInviteRes;
import com.skillstack.team.service.InviteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserService userService;
    private final InviteService inviteService;
    private final UserMapper userMapper;
    private final OAuthService oAuthService;
    private final OAuthProviderService oAuthProviderService;
    private final CliDeviceAuthService cliDeviceAuthService;

    @PostMapping("/api/auth/sms-code")
    public ApiResponse<Map<String, Object>> smsCode(@Valid @RequestBody SmsCodeReq req) {
        return ApiResponse.ok(authService.sendSmsCode(req.getPhone(), req.getPurpose()));
    }

    @PostMapping("/api/auth/login")
    public ApiResponse<LoginRes> login(@Valid @RequestBody LoginReq req) {
        return ApiResponse.ok(authService.login(req));
    }

    @GetMapping("/api/auth/providers")
    public ApiResponse<List<PublicProviderVO>> providers() {
        return ApiResponse.ok(oAuthProviderService.listPublic());
    }

    @GetMapping("/api/auth/oauth/{provider}/url")
    public ApiResponse<AuthUrlVO> oauthUrl(@PathVariable String provider,
                                           @RequestParam(required = false) String returnTo) {
        return ApiResponse.ok(oAuthService.buildAuthorizeUrl(provider, returnTo));
    }

    @GetMapping("/api/auth/oauth/{provider}/callback")
    public ApiResponse<LoginRes> oauthCallback(@PathVariable String provider,
                                               @RequestParam String code,
                                               @RequestParam String state) {
        return ApiResponse.ok(oAuthService.handleCallback(provider, code, state));
    }

    @GetMapping("/api/auth/feishu/url")
    public ApiResponse<AuthUrlVO> feishuUrl() {
        return ApiResponse.ok(oAuthService.buildAuthorizeUrl("feishu", null));
    }

    @GetMapping("/api/auth/feishu/callback")
    public ApiResponse<LoginRes> feishuCallback(@RequestParam String code, @RequestParam String state) {
        return ApiResponse.ok(oAuthService.handleCallback("feishu", code, state));
    }

    @PostMapping("/api/auth/register/step1")
    public ApiResponse<Map<String, Object>> step1(@Valid @RequestBody RegisterStep1Req req) {
        return ApiResponse.ok(authService.registerStep1(req));
    }

    @PostMapping("/api/auth/register/step2")
    public ApiResponse<Map<String, Object>> step2(@Valid @RequestBody RegisterStep2Req req) {
        return ApiResponse.ok(authService.registerStep2(req));
    }

    @PostMapping("/api/auth/register/step3")
    public ApiResponse<Map<String, Object>> step3(@Valid @RequestBody RegisterStep3Req req) {
        return ApiResponse.ok(authService.registerStep3(req));
    }

    @PostMapping("/api/auth/register/step4")
    public ApiResponse<LoginRes> step4(@Valid @RequestBody RegisterStep4Req req) {
        return ApiResponse.ok(authService.registerStep4(req));
    }

    @GetMapping("/api/me")
    public ApiResponse<MeRes> me(@AuthenticationPrincipal CurrentUser me) {
        if (me == null) {
            throw new BusinessException(40100, "未登录");
        }
        return ApiResponse.ok(userService.buildMe(me.getId()));
    }

    /** 查询当前用户收到的待响应手机邀请（用于 NoTeamPage 入口提示）。 */
    @GetMapping("/api/me/invites/phones")
    public ApiResponse<List<MyPhoneInviteRes>> myPhoneInvites(@AuthenticationPrincipal CurrentUser me) {
        if (me == null) {
            throw new BusinessException(40100, "未登录");
        }
        User user = userMapper.selectById(me.getId());
        return ApiResponse.ok(inviteService.listMyPhoneInvites(user == null ? null : user.getPhone()));
    }

    // ----- CLI device authorization (smskill login --web) -----

    @GetMapping("/api/auth/cli/web-info")
    public ApiResponse<CliWebInfoRes> cliWebInfo() {
        return ApiResponse.ok(cliDeviceAuthService.webInfo());
    }

    @PostMapping("/api/auth/cli/device-init")
    public ApiResponse<CliDeviceInitRes> cliDeviceInit(
            @RequestHeader(value = "User-Agent", required = false) String userAgent) {
        return ApiResponse.ok(cliDeviceAuthService.initDevice(userAgent));
    }

    @PostMapping("/api/auth/cli/device-poll")
    public ApiResponse<CliDevicePollRes> cliDevicePoll(@Valid @RequestBody CliDevicePollReq req) {
        return ApiResponse.ok(cliDeviceAuthService.pollDevice(req.getDeviceCode()));
    }

    @GetMapping("/api/me/cli/device/{userCode}")
    public ApiResponse<CliDeviceLookupRes> cliDeviceLookup(@AuthenticationPrincipal CurrentUser me,
                                                           @PathVariable String userCode) {
        if (me == null) throw new BusinessException(40100, "未登录");
        return ApiResponse.ok(cliDeviceAuthService.lookup(userCode));
    }

    @PostMapping("/api/me/cli/device/{userCode}/approve")
    public ApiResponse<Void> cliDeviceApprove(@AuthenticationPrincipal CurrentUser me,
                                              @PathVariable String userCode,
                                              @RequestBody(required = false) CliDeviceApproveReq req) {
        if (me == null) throw new BusinessException(40100, "未登录");
        boolean remember = req != null && Boolean.TRUE.equals(req.getRemember());
        cliDeviceAuthService.approve(userCode, me.getId(), remember);
        return ApiResponse.ok(null);
    }

    @PostMapping("/api/me/cli/device/{userCode}/deny")
    public ApiResponse<Void> cliDeviceDeny(@AuthenticationPrincipal CurrentUser me,
                                           @PathVariable String userCode) {
        if (me == null) throw new BusinessException(40100, "未登录");
        cliDeviceAuthService.deny(userCode, me.getId());
        return ApiResponse.ok(null);
    }
}
