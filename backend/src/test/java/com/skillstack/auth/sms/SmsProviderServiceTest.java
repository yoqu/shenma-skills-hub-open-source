package com.skillstack.auth.sms;

import com.skillstack.admin.service.AuditLogService;
import com.skillstack.auth.sms.dto.UpdateSmsProviderReq;
import com.skillstack.auth.sms.entity.SmsProviderConfig;
import com.skillstack.auth.sms.mapper.SmsProviderConfigMapper;
import com.skillstack.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SmsProviderServiceTest {

    private SmsProviderConfigMapper mapper;
    private SmsProviderService service;

    @BeforeEach
    void setUp() {
        mapper = mock(SmsProviderConfigMapper.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        service = new SmsProviderService(mapper, auditLogService);
    }

    @Test
    void getAdminInitializesDefaultHttpConfig() {
        when(mapper.selectById("sms_login")).thenReturn(null);

        var vo = service.getAdmin();

        assertThat(vo.getCode()).isEqualTo("sms_login");
        assertThat(vo.getEnabled()).isFalse();
        assertThat(vo.getProviderType()).isEqualTo("HTTP");
        assertThat(vo.getSecretJsonSet()).isFalse();
        verify(mapper).insert(any(SmsProviderConfig.class));
    }

    @Test
    void updateMasksAndPreservesSensitiveHeadersInSingleHeadersJson() {
        SmsProviderConfig existing = configuredHttp();
        existing.setHeadersJson("""
                [
                  {"name":"Authorization","value":"Bearer old","secret":true},
                  {"name":"Content-Type","value":"application/json","secret":false}
                ]
                """);
        when(mapper.selectById("sms_login")).thenReturn(existing);

        UpdateSmsProviderReq req = new UpdateSmsProviderReq();
        req.setHeadersJson("""
                [
                  {"name":"Authorization","value":"","secret":true,"valueSet":true},
                  {"name":"X-App","value":"skillstack","secret":false}
                ]
                """);

        var vo = service.update(req, 9L);

        ArgumentCaptor<SmsProviderConfig> captor = ArgumentCaptor.forClass(SmsProviderConfig.class);
        verify(mapper).updateById(captor.capture());
        SmsProviderConfig saved = captor.getValue();
        assertThat(saved.getHeadersJson()).contains("Bearer old");
        assertThat(saved.getHeadersJson()).contains("X-App");
        assertThat(vo.getHeadersJson()).contains("\"value\":\"\"");
        assertThat(vo.getHeadersJson()).contains("\"valueSet\":true");
        assertThat(vo.getHeadersJson()).doesNotContain("Bearer old");
    }

    @Test
    void updatePreservesProviderSecretJsonWhenMaskedValueIsSubmitted() {
        SmsProviderConfig existing = configuredLingyang();
        existing.setSecretJson("{\"accessSecret\":\"old-secret\"}");
        when(mapper.selectById("sms_login")).thenReturn(existing);

        UpdateSmsProviderReq req = new UpdateSmsProviderReq();
        req.setSecretJson("{\"accessSecret\":\"\",\"accessSecretSet\":true}");

        var vo = service.update(req, 9L);

        ArgumentCaptor<SmsProviderConfig> captor = ArgumentCaptor.forClass(SmsProviderConfig.class);
        verify(mapper).updateById(captor.capture());
        assertThat(captor.getValue().getSecretJson()).isEqualTo("{\"accessSecret\":\"old-secret\"}");
        assertThat(vo.getSecretJson()).contains("\"accessSecret\":\"\"");
        assertThat(vo.getSecretJson()).contains("\"accessSecretSet\":true");
    }

    @Test
    void updateCanClearProviderSecretJson() {
        SmsProviderConfig existing = configuredLingyang();
        existing.setEnabled(false);
        existing.setSecretJson("{\"accessSecret\":\"old-secret\"}");
        when(mapper.selectById("sms_login")).thenReturn(existing);

        UpdateSmsProviderReq req = new UpdateSmsProviderReq();
        req.setSecretJson("");

        service.update(req, 9L);

        ArgumentCaptor<SmsProviderConfig> captor = ArgumentCaptor.forClass(SmsProviderConfig.class);
        verify(mapper).updateById(captor.capture());
        assertThat(captor.getValue().getSecretJson()).isNull();
    }

    @Test
    void enablingHttpRequiresEndpointAndBodyTemplate() {
        when(mapper.selectById("sms_login")).thenReturn(defaultConfig());

        UpdateSmsProviderReq req = new UpdateSmsProviderReq();
        req.setEnabled(true);
        req.setEndpointUrl(" ");
        req.setBodyTemplate(" ");

        assertThatThrownBy(() -> service.update(req, 9L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("短信供应商配置不完整");
    }

    @Test
    void enablingLingyangRequiresProviderFieldsAndSecret() {
        SmsProviderConfig existing = defaultConfig();
        existing.setProviderType("LINGYANG_CHAOXIN");
        existing.setEndpointUrl("https://lingyang.example.test");
        existing.setExtraJson("{\"appId\":\"app\",\"accessKey\":\"ak\",\"signName\":\"签名\",\"templateCode\":\"TPL\"}");
        when(mapper.selectById("sms_login")).thenReturn(existing);

        UpdateSmsProviderReq req = new UpdateSmsProviderReq();
        req.setEnabled(true);

        assertThatThrownBy(() -> service.update(req, 9L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("短信供应商配置不完整");
    }

    @Test
    void requireEnabledConfigRejectsDisabledConfig() {
        SmsProviderConfig existing = configuredHttp();
        existing.setEnabled(false);
        when(mapper.selectById("sms_login")).thenReturn(existing);

        assertThat(service.getEnabledConfig()).isEmpty();
    }

    @Test
    void updateRecordsAuditWithoutSecretPayload() {
        SmsProviderConfig existing = configuredLingyang();
        when(mapper.selectById("sms_login")).thenReturn(existing);
        AuditLogService auditLogService = mock(AuditLogService.class);
        service = new SmsProviderService(mapper, auditLogService);

        UpdateSmsProviderReq req = new UpdateSmsProviderReq();
        req.setSecretJson("{\"accessSecret\":\"new-secret\"}");

        service.update(req, 9L);

        verify(auditLogService).record(eq(9L), eq("sms.provider.update"), eq("sms_provider_config"), eq(null), any());
    }

    private SmsProviderConfig defaultConfig() {
        SmsProviderConfig c = new SmsProviderConfig();
        c.setCode("sms_login");
        c.setDisplayName("短信验证码");
        c.setEnabled(false);
        c.setProviderType("HTTP");
        c.setMethod("POST");
        c.setSuccessStatus(200);
        return c;
    }

    private SmsProviderConfig configuredHttp() {
        SmsProviderConfig c = defaultConfig();
        c.setEnabled(true);
        c.setEndpointUrl("https://sms.example.test/send");
        c.setHeadersJson("[{\"name\":\"Content-Type\",\"value\":\"application/json\",\"secret\":false}]");
        c.setBodyTemplate("{\"phone\":\"${phone}\",\"code\":\"${code}\"}");
        return c;
    }

    private SmsProviderConfig configuredLingyang() {
        SmsProviderConfig c = defaultConfig();
        c.setEnabled(true);
        c.setProviderType("LINGYANG_CHAOXIN");
        c.setEndpointUrl("https://lingyang.example.test");
        c.setExtraJson("{\"appId\":\"app\",\"accessKey\":\"ak\",\"signName\":\"签名\",\"templateCode\":\"TPL\"}");
        c.setSecretJson("{\"accessSecret\":\"secret\"}");
        return c;
    }
}
