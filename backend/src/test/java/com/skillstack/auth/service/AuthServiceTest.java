package com.skillstack.auth.service;

import com.skillstack.auth.dto.RegisterStep1Req;
import com.skillstack.auth.dto.RegisterStep2Req;
import com.skillstack.auth.dto.RegisterStep3Req;
import com.skillstack.auth.dto.RegisterStep4Req;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.sms.SmsProviderService;
import com.skillstack.auth.sms.SmsSenderDispatcher;
import com.skillstack.auth.sms.entity.SmsProviderConfig;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.RecordComponent;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceTest {

    private AuthService authService;
    private FakeUserService userService;

    @BeforeEach
    void setUp() {
        userService = new FakeUserService();
        authService = new AuthService(
                userService,
                null,
                null,
                null,
                null,
                null
        );
        ReflectionTestUtils.setField(
                authService,
                "jwtSecret",
                "skillstack-test-secret-with-at-least-32-bytes"
        );
        ReflectionTestUtils.invokeMethod(authService, "init");
    }

    @Test
    void sendSmsCodeDoesNotExposeVerificationCode() {
        Map<String, Object> res = authService.sendSmsCode("13900001111");

        assertThat(res).containsEntry("ttl", AuthService.SMS_TTL_SECONDS);
        assertThat(res).doesNotContainKey("code");
    }

    @Test
    void registerStep1RejectsFixedCodeWhenNoCodeWasIssued() {
        RegisterStep1Req req = new RegisterStep1Req();
        req.setPhone("13900001112");
        req.setSmsCode("1234");

        assertThatThrownBy(() -> authService.registerStep1(req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("验证码");
    }

    @Test
    void registerStep1AcceptsOnlyIssuedCode() throws Exception {
        String phone = "13900001113";
        authService.sendSmsCode(phone);

        RegisterStep1Req req = new RegisterStep1Req();
        req.setPhone(phone);
        req.setSmsCode(issuedCodeFor(phone));

        assertThat(authService.registerStep1(req)).containsKey("regToken");
    }

    @Test
    void fullRegisterFlowCreatesUserWithIssuedCode() throws Exception {
        FlowUserService flowUserService = new FlowUserService();
        PasswordEncoder encoder = new BCryptPasswordEncoder();
        AuthService flowAuthService = new AuthService(
                flowUserService,
                new JwtUtil("skillstack-test-secret-with-at-least-32-bytes", 3600, 1800, "skillstack"),
                encoder,
                null,
                null,
                null
        );
        ReflectionTestUtils.setField(
                flowAuthService,
                "jwtSecret",
                "skillstack-test-secret-with-at-least-32-bytes"
        );
        ReflectionTestUtils.invokeMethod(flowAuthService, "init");

        String phone = "13900001114";
        flowAuthService.sendSmsCode(phone);
        RegisterStep1Req step1Req = new RegisterStep1Req();
        step1Req.setPhone(phone);
        step1Req.setSmsCode(issuedCodeFor(flowAuthService, phone));
        String regToken1 = (String) flowAuthService.registerStep1(step1Req).get("regToken");

        RegisterStep2Req step2Req = new RegisterStep2Req();
        step2Req.setRegToken(regToken1);
        step2Req.setHandle("qa_register_flow");
        step2Req.setName("QA Register");
        step2Req.setPassword("password");
        String regToken2 = (String) flowAuthService.registerStep2(step2Req).get("regToken");

        RegisterStep3Req step3Req = new RegisterStep3Req();
        step3Req.setRegToken(regToken2);
        step3Req.setAvatar("Q");
        String regToken3 = (String) flowAuthService.registerStep3(step3Req).get("regToken");

        RegisterStep4Req step4Req = new RegisterStep4Req();
        step4Req.setRegToken(regToken3);
        var res = flowAuthService.registerStep4(step4Req);

        assertThat(res.getUser().getHandle()).isEqualTo("qa_register_flow");
        assertThat(flowUserService.inserted).isEqualTo(1);
        assertThat(flowUserService.handleExists("qa_register_flow")).isTrue();
    }

    @Test
    void sendSmsCodeUsesEnabledHttpProviderBeforeStoringCode() throws Exception {
        SmsProviderService providerService = mock(SmsProviderService.class);
        SmsSenderDispatcher smsSender = mock(SmsSenderDispatcher.class);
        SmsProviderConfig config = enabledSmsConfig();
        when(providerService.getEnabledConfig()).thenReturn(Optional.of(config));
        AuthService service = new AuthService(new ExistingPhoneUserService(), null, null, null, providerService, smsSender);
        ReflectionTestUtils.setField(
                service,
                "jwtSecret",
                "skillstack-test-secret-with-at-least-32-bytes"
        );
        ReflectionTestUtils.invokeMethod(service, "init");

        service.sendSmsCode("13900001115", "login");

        String code = issuedCodeFor(service, "13900001115");
        verify(smsSender).send(config, "13900001115", code, "login", AuthService.SMS_TTL_SECONDS);
    }

    @Test
    void sendSmsCodeDoesNotStoreCodeWhenHttpProviderFails() throws Exception {
        SmsProviderService providerService = mock(SmsProviderService.class);
        SmsSenderDispatcher smsSender = mock(SmsSenderDispatcher.class);
        SmsProviderConfig config = enabledSmsConfig();
        when(providerService.getEnabledConfig()).thenReturn(Optional.of(config));
        org.mockito.Mockito.doThrow(new BusinessException(40041, "短信发送失败"))
                .when(smsSender).send(
                        org.mockito.ArgumentMatchers.eq(config),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyLong()
                );
        AuthService service = new AuthService(new ExistingPhoneUserService(), null, null, null, providerService, smsSender);
        ReflectionTestUtils.setField(
                service,
                "jwtSecret",
                "skillstack-test-secret-with-at-least-32-bytes"
        );
        ReflectionTestUtils.invokeMethod(service, "init");

        assertThatThrownBy(() -> service.sendSmsCode("13900001116", "login"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("短信发送失败");

        @SuppressWarnings("unchecked")
        Map<String, Object> smsStore = (Map<String, Object>) ReflectionTestUtils.getField(service, "smsStore");
        assertThat(smsStore).doesNotContainKey("13900001116");
    }

    private String issuedCodeFor(String phone) throws Exception {
        return issuedCodeFor(authService, phone);
    }

    private String issuedCodeFor(AuthService service, String phone) throws Exception {
        @SuppressWarnings("unchecked")
        Map<String, Object> smsStore = (Map<String, Object>) ReflectionTestUtils.getField(service, "smsStore");
        Object entry = smsStore.get(phone);
        for (RecordComponent component : entry.getClass().getRecordComponents()) {
            if ("code".equals(component.getName())) {
                return (String) component.getAccessor().invoke(entry);
            }
        }
        throw new IllegalStateException("SmsEntry.code not found");
    }

    private SmsProviderConfig enabledSmsConfig() {
        SmsProviderConfig config = new SmsProviderConfig();
        config.setCode("sms_http");
        config.setEnabled(true);
        config.setProviderType("HTTP");
        config.setEndpointUrl("https://sms.example.test/send");
        config.setBodyTemplate("{\"phone\":\"${phone}\",\"code\":\"${code}\"}");
        return config;
    }

    private static class FakeUserService extends UserService {
        FakeUserService() {
            super(null, null, null, null, null);
        }

        @Override
        public boolean phoneExists(String phone) {
            return false;
        }
    }

    private static class ExistingPhoneUserService extends FakeUserService {
        @Override
        public boolean phoneExists(String phone) {
            return true;
        }
    }

    private static class FlowUserService extends UserService {
        private final Map<String, User> usersByHandle = new java.util.HashMap<>();
        private final Map<String, User> usersByPhone = new java.util.HashMap<>();
        private long nextId = 1;
        private int inserted = 0;

        FlowUserService() {
            super(null, null, null, null, null);
        }

        @Override
        public boolean handleExists(String handle) {
            return usersByHandle.containsKey(handle);
        }

        @Override
        public boolean phoneExists(String phone) {
            return usersByPhone.containsKey(phone);
        }

        @Override
        public Long insert(User u) {
            u.setId(nextId++);
            inserted++;
            usersByHandle.put(u.getHandle(), u);
            usersByPhone.put(u.getPhone(), u);
            return u.getId();
        }

        @Override
        public User findByPhone(String phone) {
            return usersByPhone.get(phone);
        }

        @Override
        public com.skillstack.auth.dto.MeRes buildMe(Long userId) {
            User found = usersByHandle.values().stream()
                    .filter(u -> userId.equals(u.getId()))
                    .findFirst()
                    .orElseThrow();
            return com.skillstack.auth.dto.MeRes.builder()
                    .id(found.getId())
                    .handle(found.getHandle())
                    .name(found.getName())
                    .phone(found.getPhone())
                    .avatar(found.getAvatar())
                    .build();
        }
    }
}
