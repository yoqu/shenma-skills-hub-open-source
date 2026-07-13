package com.skillstack.admin.controller;

import com.skillstack.admin.service.AuditLogService;
import com.skillstack.auth.oauth.dto.AdminProviderVO;
import com.skillstack.auth.oauth.dto.UpdateProviderReq;
import com.skillstack.auth.oauth.entity.OAuthProvider;
import com.skillstack.auth.oauth.mapper.OAuthProviderMapper;
import com.skillstack.auth.oauth.service.OAuthProviderService;
import com.skillstack.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminOAuthControllerTest {

    private OAuthProviderMapper providerMapper;
    private AuditLogService auditLogService;
    private OAuthProviderService providerService;

    @BeforeEach
    void setUp() {
        providerMapper = mock(OAuthProviderMapper.class);
        auditLogService = mock(AuditLogService.class);
        providerService = new OAuthProviderService(providerMapper, auditLogService);
    }

    private OAuthProvider feishuProvider() {
        OAuthProvider p = new OAuthProvider();
        p.setCode("feishu");
        p.setDisplayName("飞书");
        p.setEnabled(true);
        p.setClientId("app_id");
        p.setClientSecret("secret");
        p.setRedirectUri("http://localhost/callback");
        p.setAuthorizeUrl("https://open.feishu.cn/authorize");
        p.setTokenUrl("https://open.feishu.cn/token");
        p.setUserinfoUrl("https://open.feishu.cn/userinfo");
        p.setSortOrder(10);
        return p;
    }

    @Test
    void adminListDoesNotExposeClientSecretValue() {
        when(providerMapper.selectList(any())).thenReturn(List.of(feishuProvider()));

        List<AdminProviderVO> list = providerService.listAdmin();
        assertThat(list).hasSize(1);
        AdminProviderVO vo = list.get(0);
        assertThat(vo.getClientSecretSet()).isTrue();
    }

    @Test
    void getAdminUnknownCodeThrows() {
        when(providerMapper.selectById("unknown")).thenReturn(null);

        assertThatThrownBy(() -> providerService.getAdmin("unknown"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("未知");
    }

    @Test
    void updateAuditPayloadDoesNotContainClientSecret() {
        OAuthProvider p = feishuProvider();
        when(providerMapper.selectById("feishu")).thenReturn(p);
        when(providerMapper.updateById(any())).thenReturn(1);

        java.util.concurrent.atomic.AtomicReference<java.util.Map<String, Object>> capturedPayload =
                new java.util.concurrent.atomic.AtomicReference<>();
        org.mockito.Mockito.doAnswer(inv -> {
            capturedPayload.set(inv.getArgument(4));
            return null;
        }).when(auditLogService).record(
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any());

        UpdateProviderReq req = new UpdateProviderReq();
        req.setClientSecret("new_secret");
        providerService.update("feishu", req, 1L);

        assertThat(capturedPayload.get()).isNotNull();
        assertThat(capturedPayload.get().toString()).doesNotContain("new_secret");
        assertThat(capturedPayload.get()).containsKey("clientSecretChanged");
        assertThat(capturedPayload.get().get("clientSecretChanged")).isEqualTo(true);
    }

    @Test
    void updateEnabledToggle() {
        OAuthProvider p = feishuProvider();
        when(providerMapper.selectById("feishu")).thenReturn(p);
        when(providerMapper.updateById(any())).thenReturn(1);

        UpdateProviderReq req = new UpdateProviderReq();
        req.setEnabled(false);
        AdminProviderVO result = providerService.update("feishu", req, 1L);

        assertThat(result.getEnabled()).isFalse();
    }
}
