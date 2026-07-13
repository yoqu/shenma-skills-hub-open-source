package com.skillstack.auth.oauth.service;

import com.skillstack.auth.dto.LoginRes;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.oauth.dto.AuthUrlVO;
import com.skillstack.auth.oauth.entity.OAuthProvider;
import com.skillstack.auth.oauth.feishu.FeishuAuthClient;
import com.skillstack.auth.oauth.feishu.FeishuUserProfile;
import com.skillstack.auth.oauth.linuxdo.LinuxDoOAuthClient;
import com.skillstack.auth.oauth.linuxdo.LinuxDoTokenResponse;
import com.skillstack.auth.oauth.linuxdo.LinuxDoUserProfile;
import com.skillstack.auth.service.UserService;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class OAuthService {

    private final OAuthProviderService providerService;
    private final OAuthStateStore stateStore;
    private final OAuthIdentityService identityService;
    private final FeishuAuthClient feishuAuthClient;
    private final LinuxDoOAuthClient linuxDoOAuthClient;
    private final UserService userService;
    private final JwtUtil jwtUtil;

    public AuthUrlVO buildAuthorizeUrl(String providerCode, String returnTo) {
        OAuthProvider provider = providerService.requireConfigured(providerCode);
        String state = stateStore.generate(returnTo);
        String authUrl = UriComponentsBuilder.fromHttpUrl(provider.getAuthorizeUrl())
                .queryParam("response_type", "code")
                .queryParam("client_id", provider.getClientId())
                .queryParam("redirect_uri", provider.getRedirectUri())
                .queryParam("scope", provider.getScope() == null ? "" : provider.getScope())
                .queryParam("state", state)
                .build()
                .encode()
                .toUriString();
        return AuthUrlVO.builder().authUrl(authUrl).state(state).build();
    }

    public LoginRes handleCallback(String providerCode, String code, String state) {
        if (isBlank(code)) {
            throw new BusinessException(40031, "OAuth 回调缺少 code");
        }
        if (isBlank(state)) {
            throw new BusinessException(40031, "OAuth 回调缺少 state");
        }
        stateStore.verify(state);
        OAuthProvider provider = providerService.requireConfigured(providerCode);

        OAuthIdentityService.OAuthProfile profile = fetchProfile(providerCode, provider, code);
        User user = identityService.loginOrCreate(providerCode, profile);
        return LoginRes.builder()
                .token(jwtUtil.generate(user.getId(), user.getHandle(), true))
                .user(userService.buildMe(user.getId()))
                .build();
    }

    private OAuthIdentityService.OAuthProfile fetchProfile(String providerCode, OAuthProvider provider, String code) {
        return switch (providerCode) {
            case "feishu" -> fetchFeishuProfile(provider, code);
            case "linux_do" -> fetchLinuxDoProfile(provider, code);
            default -> throw new BusinessException(40035, "未知 OAuth provider: " + providerCode);
        };
    }

    private OAuthIdentityService.OAuthProfile fetchFeishuProfile(OAuthProvider provider, String code) {
        try {
            String appToken = feishuAuthClient.getAppAccessToken(provider.getClientId(), provider.getClientSecret());
            String userToken = feishuAuthClient.getUserAccessToken(code, appToken, provider.getTokenUrl());
            FeishuUserProfile fp = feishuAuthClient.getUserProfile(userToken, provider.getUserinfoUrl());
            if (isBlank(fp.openId()) || isBlank(fp.tenantKey())) {
                throw new BusinessException(40031, "飞书用户信息不完整");
            }
            return new OAuthIdentityService.OAuthProfile(
                    fp.openId(),
                    fp.unionId(),
                    null,
                    fp.name(),
                    fp.email(),
                    fp.avatarUrl(),
                    null
            );
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("feishu callback failed: {}", e.getMessage());
            throw new BusinessException(40032, "飞书登录失败");
        }
    }

    private OAuthIdentityService.OAuthProfile fetchLinuxDoProfile(OAuthProvider provider, String code) {
        try {
            LinuxDoTokenResponse token = linuxDoOAuthClient.exchangeCode(
                    code, provider.getClientId(), provider.getClientSecret(),
                    provider.getRedirectUri(), provider.getTokenUrl());
            LinuxDoUserProfile lp = linuxDoOAuthClient.fetchUser(token.accessToken(), provider.getUserinfoUrl());
            if (!lp.active()) {
                throw new BusinessException(40032, "linux.do 账号已被停用");
            }
            return new OAuthIdentityService.OAuthProfile(
                    lp.id(),
                    null,
                    lp.username(),
                    lp.nickname(),
                    lp.email(),
                    lp.avatarUrl(),
                    lp.rawProfileJson()
            );
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("linux.do callback failed: {}", e.getMessage());
            throw new BusinessException(40032, "linux.do 登录失败");
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
