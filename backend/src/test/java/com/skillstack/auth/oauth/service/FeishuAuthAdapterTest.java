package com.skillstack.auth.oauth.service;

import com.skillstack.auth.dto.LoginRes;
import com.skillstack.auth.dto.MeRes;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.oauth.dto.AuthUrlVO;
import com.skillstack.auth.oauth.entity.OAuthProvider;
import com.skillstack.auth.oauth.feishu.FeishuAuthClient;
import com.skillstack.auth.oauth.feishu.FeishuUserProfile;
import com.skillstack.auth.oauth.linuxdo.LinuxDoOAuthClient;
import com.skillstack.auth.service.UserService;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.JwtUtil;
import com.skillstack.common.systemconfig.SystemConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FeishuAuthAdapterTest {

    private OAuthProviderService providerService;
    private OAuthStateStore stateStore;
    private OAuthIdentityService identityService;
    private FeishuAuthClient feishuClient;
    private UserService userService;
    private JwtUtil jwtUtil;
    private OAuthService oAuthService;

    @BeforeEach
    void setUp() {
        providerService = mock(OAuthProviderService.class);
        stateStore = new OAuthStateStore("test-secret-at-least-16-chars", 600, mock(SystemConfigService.class));
        identityService = mock(OAuthIdentityService.class);
        feishuClient = mock(FeishuAuthClient.class);
        LinuxDoOAuthClient linuxDoClient = mock(LinuxDoOAuthClient.class);
        userService = mock(UserService.class);
        jwtUtil = new JwtUtil("skillstack-test-secret-with-at-least-32-bytes", 3600, 1800, "skillstack");
        oAuthService = new OAuthService(providerService, stateStore, identityService, feishuClient, linuxDoClient, userService, jwtUtil);
    }

    private OAuthProvider feishuProvider() {
        OAuthProvider p = new OAuthProvider();
        p.setCode("feishu");
        p.setEnabled(true);
        p.setClientId("cli_test");
        p.setClientSecret("secret_test");
        p.setRedirectUri("http://localhost:5173/auth/callback");
        p.setScope("");
        p.setAuthorizeUrl("https://open.feishu.cn/open-apis/authen/v1/authorize");
        p.setTokenUrl("https://open.feishu.cn/open-apis/authen/v1/access_token");
        p.setUserinfoUrl("https://open.feishu.cn/open-apis/authen/v1/user_info");
        return p;
    }

    @Test
    void buildAuthorizeUrlContainsFeishuHost() {
        when(providerService.requireConfigured("feishu")).thenReturn(feishuProvider());

        AuthUrlVO result = oAuthService.buildAuthorizeUrl("feishu", "/");
        assertThat(result.getAuthUrl()).contains("open.feishu.cn");
        assertThat(result.getState()).isNotBlank();
    }

    @Test
    void handleCallbackFullFlow() {
        when(providerService.requireConfigured("feishu")).thenReturn(feishuProvider());
        when(feishuClient.getAppAccessToken(anyString(), anyString())).thenReturn("app_token");
        when(feishuClient.getUserAccessToken(anyString(), anyString(), anyString())).thenReturn("user_token");
        when(feishuClient.getUserProfile(anyString(), anyString()))
                .thenReturn(new FeishuUserProfile("ou_test", "on_test", "tenant_test", "飞书用户", "https://example.test/avatar.png", "feishu@example.test", null));

        User user = new User();
        user.setId(1L);
        user.setHandle("feishu_user");
        when(identityService.loginOrCreate(eq("feishu"), any())).thenReturn(user);
        when(userService.buildMe(1L)).thenReturn(MeRes.builder().id(1L).handle("feishu_user").name("飞书用户").build());

        String state = stateStore.generate("/");
        LoginRes res = oAuthService.handleCallback("feishu", "auth_code", state);

        assertThat(res.getToken()).isNotBlank();
        assertThat(res.getUser().getName()).isEqualTo("飞书用户");
    }

    @Test
    void handleCallbackInvalidStateThrows() {
        when(providerService.requireConfigured("feishu")).thenReturn(feishuProvider());
        assertThatThrownBy(() -> oAuthService.handleCallback("feishu", "code", "bad_state"))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void handleCallbackMissingStateThrows() {
        assertThatThrownBy(() -> oAuthService.handleCallback("feishu", "code", null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("state");
    }
}
