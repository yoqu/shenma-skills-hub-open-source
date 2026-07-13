package com.skillstack.auth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillstack.auth.dto.MeRes;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class FeishuAuthServiceTest {

    @Test
    void loginByCallbackCreatesJwtUserWithoutRequiredPhone() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).build();
        FeishuStateStore stateStore = new FeishuStateStore(600);
        FakeUserService userService = new FakeUserService();
        FeishuAuthService service = new FeishuAuthService(
                stateStore,
                new ObjectMapper(),
                userService,
                new JwtUtil("skillstack-test-secret-with-at-least-32-bytes", 3600, 1800, "skillstack"),
                restTemplate
        );
        ReflectionTestUtils.setField(service, "appId", "cli_test");
        ReflectionTestUtils.setField(service, "appSecret", "secret_test");
        ReflectionTestUtils.setField(service, "redirectUri", "http://localhost:5173/auth/callback");

        server.expect(once(), requestTo("https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("""
                        {"code":0,"app_access_token":"app_token"}
                        """, MediaType.APPLICATION_JSON));
        server.expect(once(), requestTo("https://open.feishu.cn/open-apis/authen/v1/access_token"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("""
                        {"code":0,"data":{"access_token":"user_token"}}
                        """, MediaType.APPLICATION_JSON));
        server.expect(once(), requestTo("https://open.feishu.cn/open-apis/authen/v1/user_info"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {"code":0,"data":{"open_id":"ou_test","union_id":"on_test","tenant_key":"tenant_test","name":"飞书用户","avatar_url":"https://example.test/avatar.png","email":"feishu@example.test"}}
                        """, MediaType.APPLICATION_JSON));

        String state = stateStore.generate();
        var res = service.loginByCallback("auth_code", state);

        assertThat(res.getToken()).isNotBlank();
        assertThat(res.getUser().getName()).isEqualTo("飞书用户");
        assertThat(res.getUser().getPhone()).isNull();
        assertThat(userService.saved.getFeishuOpenId()).isEqualTo("ou_test");
        server.verify();
    }

    private static class FakeUserService extends UserService {
        private User saved;

        FakeUserService() {
            super(null, null, new BCryptPasswordEncoder(), null, null);
        }

        @Override
        public User upsertByFeishuUser(FeishuAuthService.FeishuUserInfo info) {
            saved = new User();
            saved.setId(99L);
            saved.setHandle("fs_ou_test");
            saved.setName(info.getName());
            saved.setEmail(info.getEmail());
            saved.setPhone(info.getMobile());
            saved.setFeishuOpenId(info.getOpenId());
            saved.setFeishuTenantKey(info.getTenantKey());
            return saved;
        }

        @Override
        public MeRes buildMe(Long userId) {
            return MeRes.builder()
                    .id(saved.getId())
                    .handle(saved.getHandle())
                    .name(saved.getName())
                    .email(saved.getEmail())
                    .phone(saved.getPhone())
                    .build();
        }
    }
}
