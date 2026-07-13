package com.skillstack.auth.oauth.service;

import com.skillstack.auth.dto.LoginRes;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.oauth.dto.AuthUrlVO;
import com.skillstack.auth.oauth.entity.OAuthProvider;
import com.skillstack.auth.oauth.feishu.FeishuAuthClient;
import com.skillstack.auth.oauth.linuxdo.HttpLinuxDoOAuthClient;
import com.skillstack.auth.oauth.linuxdo.LinuxDoOAuthClient;
import com.skillstack.auth.oauth.linuxdo.LinuxDoTokenResponse;
import com.skillstack.auth.oauth.linuxdo.LinuxDoUserProfile;
import com.skillstack.auth.service.UserService;
import com.skillstack.auth.dto.MeRes;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.JwtUtil;
import com.skillstack.common.systemconfig.SystemConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LinuxDoAuthAdapterTest {

    private OAuthProviderService providerService;
    private OAuthStateStore stateStore;
    private OAuthIdentityService identityService;
    private LinuxDoOAuthClient linuxDoClient;
    private UserService userService;
    private JwtUtil jwtUtil;
    private OAuthService oAuthService;

    @BeforeEach
    void setUp() {
        providerService = mock(OAuthProviderService.class);
        stateStore = new OAuthStateStore("test-secret-at-least-16-chars", 600, mock(SystemConfigService.class));
        identityService = mock(OAuthIdentityService.class);
        linuxDoClient = mock(LinuxDoOAuthClient.class);
        FeishuAuthClient feishuClient = mock(FeishuAuthClient.class);
        userService = mock(UserService.class);
        jwtUtil = new JwtUtil("skillstack-test-secret-with-at-least-32-bytes", 3600, 1800, "skillstack");
        oAuthService = new OAuthService(providerService, stateStore, identityService, feishuClient, linuxDoClient, userService, jwtUtil);
    }

    private OAuthProvider linuxDoProvider() {
        OAuthProvider p = new OAuthProvider();
        p.setCode("linux_do");
        p.setEnabled(true);
        p.setClientId("client_id");
        p.setClientSecret("client_secret");
        p.setRedirectUri("http://localhost:5173/auth/callback");
        p.setScope("read");
        p.setAuthorizeUrl("https://connect.linux.do/oauth2/authorize");
        p.setTokenUrl("https://connect.linux.do/oauth2/token");
        p.setUserinfoUrl("https://connect.linux.do/api/user");
        return p;
    }

    @Test
    void buildAuthorizeUrlReturnsUrlAndState() {
        when(providerService.requireConfigured("linux_do")).thenReturn(linuxDoProvider());

        AuthUrlVO result = oAuthService.buildAuthorizeUrl("linux_do", "/dashboard");
        assertThat(result.getAuthUrl()).contains("linux.do");
        assertThat(result.getState()).isNotBlank();
    }

    @Test
    void handleCallbackFullFlow() {
        when(providerService.requireConfigured("linux_do")).thenReturn(linuxDoProvider());
        when(linuxDoClient.exchangeCode(anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(new LinuxDoTokenResponse("access_token_xyz", "Bearer"));
        when(linuxDoClient.fetchUser(anyString(), anyString()))
                .thenReturn(new LinuxDoUserProfile("999", "linuxuser", "Linux User", "linux@example.com", null, true, "{}"));

        User user = new User();
        user.setId(10L);
        user.setHandle("linuxuser");
        when(identityService.loginOrCreate(eq("linux_do"), any())).thenReturn(user);
        when(userService.buildMe(10L)).thenReturn(MeRes.builder().id(10L).handle("linuxuser").build());

        String state = stateStore.generate("/");
        LoginRes res = oAuthService.handleCallback("linux_do", "auth_code_xyz", state);
        assertThat(res.getToken()).isNotBlank();
        assertThat(res.getUser().getHandle()).isEqualTo("linuxuser");
    }

    @Test
    void handleCallbackInactiveAccountThrows() {
        when(providerService.requireConfigured("linux_do")).thenReturn(linuxDoProvider());
        when(linuxDoClient.exchangeCode(anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(new LinuxDoTokenResponse("access_token_xyz", "Bearer"));
        when(linuxDoClient.fetchUser(anyString(), anyString()))
                .thenReturn(new LinuxDoUserProfile("999", "inactive", "Inactive", null, null, false, "{}"));

        String state = stateStore.generate("/");
        assertThatThrownBy(() -> oAuthService.handleCallback("linux_do", "code", state))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("停用");
    }

    @Test
    void handleCallbackMissingCodeThrows() {
        String state = stateStore.generate("/");
        assertThatThrownBy(() -> oAuthService.handleCallback("linux_do", null, state))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("code");
    }

    @Test
    void handleCallbackInvalidStateThrows() {
        when(providerService.requireConfigured("linux_do")).thenReturn(linuxDoProvider());
        assertThatThrownBy(() -> oAuthService.handleCallback("linux_do", "code", "invalid.state"))
                .isInstanceOf(BusinessException.class);
    }
}
