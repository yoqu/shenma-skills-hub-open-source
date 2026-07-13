package com.skillstack.auth.oauth.service;

import com.skillstack.admin.service.AuditLogService;
import com.skillstack.auth.oauth.dto.UpdateProviderReq;
import com.skillstack.auth.oauth.entity.OAuthProvider;
import com.skillstack.auth.oauth.mapper.OAuthProviderMapper;
import com.skillstack.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OAuthProviderServiceTest {

    private OAuthProviderMapper mapper;
    private AuditLogService auditLogService;
    private OAuthProviderService service;

    @BeforeEach
    void setUp() {
        mapper = mock(OAuthProviderMapper.class);
        auditLogService = mock(AuditLogService.class);
        service = new OAuthProviderService(mapper, auditLogService);
    }

    private OAuthProvider feishuProvider(boolean enabled) {
        OAuthProvider p = new OAuthProvider();
        p.setCode("feishu");
        p.setDisplayName("飞书");
        p.setEnabled(enabled);
        p.setClientId("app_id");
        p.setClientSecret("app_secret");
        p.setRedirectUri("http://localhost:5173/callback");
        p.setAuthorizeUrl("https://open.feishu.cn/open-apis/authen/v1/authorize");
        p.setTokenUrl("https://open.feishu.cn/open-apis/authen/v1/access_token");
        p.setUserinfoUrl("https://open.feishu.cn/open-apis/authen/v1/user_info");
        p.setSortOrder(10);
        return p;
    }

    @Test
    void listPublicOnlyReturnsEnabled() {
        OAuthProvider enabled = feishuProvider(true);
        OAuthProvider disabled = new OAuthProvider();
        disabled.setCode("linux_do");
        disabled.setEnabled(false);
        disabled.setSortOrder(20);
        when(mapper.selectList(any())).thenReturn(List.of(enabled, disabled));

        var result = service.listPublic();
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCode()).isEqualTo("feishu");
    }

    @Test
    void requireConfiguredReturnsSnapshot() {
        OAuthProvider p = feishuProvider(true);
        when(mapper.selectById("feishu")).thenReturn(p);

        OAuthProvider result = service.requireConfigured("feishu");
        assertThat(result.getCode()).isEqualTo("feishu");
        assertThat(result.getClientSecret()).isEqualTo("app_secret");
    }

    @Test
    void requireConfiguredDisabledThrows() {
        OAuthProvider p = feishuProvider(false);
        when(mapper.selectById("feishu")).thenReturn(p);

        assertThatThrownBy(() -> service.requireConfigured("feishu"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("关闭");
    }

    @Test
    void requireConfiguredMissingSecretThrows() {
        OAuthProvider p = feishuProvider(true);
        p.setClientSecret(null);
        when(mapper.selectById("feishu")).thenReturn(p);

        assertThatThrownBy(() -> service.requireConfigured("feishu"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("配置不完整");
    }

    @Test
    void requireConfiguredUnknownCodeThrows() {
        when(mapper.selectById("unknown")).thenReturn(null);
        assertThatThrownBy(() -> service.requireConfigured("unknown"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("未知");
    }

    @Test
    void updateClientSecretNullDoesNotChange() {
        OAuthProvider p = feishuProvider(true);
        when(mapper.selectById("feishu")).thenReturn(p);
        when(mapper.updateById(any())).thenReturn(1);

        UpdateProviderReq req = new UpdateProviderReq();
        req.setClientSecret(null);

        service.update("feishu", req, 1L);
        assertThat(p.getClientSecret()).isEqualTo("app_secret");
    }

    @Test
    void updateClientSecretEmptyStringClears() {
        OAuthProvider p = feishuProvider(true);
        when(mapper.selectById("feishu")).thenReturn(p);
        when(mapper.updateById(any())).thenReturn(1);

        UpdateProviderReq req = new UpdateProviderReq();
        req.setClientSecret("");

        service.update("feishu", req, 1L);
        assertThat(p.getClientSecret()).isNull();
    }

    @Test
    void updateClientSecretNonEmptyUpdates() {
        OAuthProvider p = feishuProvider(true);
        when(mapper.selectById("feishu")).thenReturn(p);
        when(mapper.updateById(any())).thenReturn(1);

        UpdateProviderReq req = new UpdateProviderReq();
        req.setClientSecret("new_secret");

        service.update("feishu", req, 1L);
        assertThat(p.getClientSecret()).isEqualTo("new_secret");
    }

    @Test
    void adminListDoesNotExposeSecret() {
        OAuthProvider p = feishuProvider(true);
        when(mapper.selectList(any())).thenReturn(List.of(p));

        var result = service.listAdmin();
        assertThat(result.get(0).getClientSecretSet()).isTrue();
    }
}
