package com.skillstack.auth.oauth.service;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.systemconfig.SystemConfigService;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OAuthStateStoreTest {

    private OAuthStateStore envConfigured(String secret, long ttl) {
        return new OAuthStateStore(secret, ttl, mock(SystemConfigService.class));
    }

    @Test
    void generateAndVerifyReturnToSlash() {
        OAuthStateStore store = envConfigured("test-secret-at-least-16-chars", 600);
        String state = store.generate("/dashboard");
        String returnTo = store.verify(state);
        assertThat(returnTo).isEqualTo("/dashboard");
    }

    @Test
    void generateNullReturnToDefaultsToSlash() {
        OAuthStateStore store = envConfigured("test-secret-at-least-16-chars", 600);
        String state = store.generate(null);
        String returnTo = store.verify(state);
        assertThat(returnTo).isEqualTo("/");
    }

    @Test
    void verifyExpiredStateThrows() throws Exception {
        OAuthStateStore store = envConfigured("test-secret-at-least-16-chars", 1);
        String state = store.generate("/");
        Thread.sleep(2100);
        assertThatThrownBy(() -> store.verify(state))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("过期");
    }

    @Test
    void verifyTamperedStateThrows() {
        OAuthStateStore store = envConfigured("test-secret-at-least-16-chars", 600);
        String state = store.generate("/");
        String tampered = state.substring(0, state.length() - 4) + "XXXX";
        assertThatThrownBy(() -> store.verify(tampered))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void verifyNullStateThrows() {
        OAuthStateStore store = envConfigured("test-secret-at-least-16-chars", 600);
        assertThatThrownBy(() -> store.verify(null))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void verifyMissingFieldsThrows() {
        OAuthStateStore store = envConfigured("test-secret-at-least-16-chars", 600);
        assertThatThrownBy(() -> store.verify("only.three.parts"))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void envSecretTakesPriorityOverSystemConfig() {
        SystemConfigService svc = mock(SystemConfigService.class);
        OAuthStateStore store = new OAuthStateStore("env-secret-at-least-16-chars", 600, svc);
        String returnTo = store.verify(store.generate("/x"));
        assertThat(returnTo).isEqualTo("/x");
        verify(svc, never()).getOrInit(any(), any());
    }

    @Test
    void emptyEnvFallsBackToSystemConfig() {
        SystemConfigService svc = mock(SystemConfigService.class);
        when(svc.getOrInit(eq("oauth.state_secret"), any()))
                .thenReturn("db-backed-secret-at-least-16-chars");
        OAuthStateStore store = new OAuthStateStore("", 600, svc);
        String returnTo = store.verify(store.generate("/db"));
        assertThat(returnTo).isEqualTo("/db");
    }

    @Test
    void isConfiguredAlwaysTrueWithDbFallback() {
        OAuthStateStore store = new OAuthStateStore("", 600, mock(SystemConfigService.class));
        assertThat(store.isConfigured()).isTrue();
    }
}
