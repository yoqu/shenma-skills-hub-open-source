package com.skillstack.auth.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillstack.auth.dto.LoginRes;
import com.skillstack.auth.entity.User;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.JwtUtil;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class FeishuAuthService {

    private static final String AUTH_URL = "https://open.feishu.cn/open-apis/authen/v1/authorize";
    private static final String APP_ACCESS_TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal";
    private static final String ACCESS_TOKEN_URL = "https://open.feishu.cn/open-apis/authen/v1/access_token";
    private static final String USER_INFO_URL = "https://open.feishu.cn/open-apis/authen/v1/user_info";

    private final FeishuStateStore stateStore;
    private final ObjectMapper objectMapper;
    private final UserService userService;
    private final JwtUtil jwtUtil;
    private final RestTemplate restTemplate;

    @Value("${skillstack.feishu.app-id:}")
    private String appId;

    @Value("${skillstack.feishu.app-secret:}")
    private String appSecret;

    @Value("${skillstack.feishu.redirect-uri:}")
    private String redirectUri;

    public AuthUrlResult generateAuthUrl() {
        requireConfigured();
        String state = stateStore.generate();
        String authUrl = UriComponentsBuilder
                .fromHttpUrl(AUTH_URL)
                .queryParam("app_id", appId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("state", state)
                .build()
                .encode()
                .toUriString();
        return new AuthUrlResult(authUrl, state);
    }

    public LoginRes loginByCallback(String code, String state) {
        requireConfigured();
        if (!stateStore.verifyAndConsume(state)) {
            throw new BusinessException(40030, "飞书登录状态已失效，请重新发起登录");
        }
        FeishuUserInfo userInfo = getUserInfo(getAccessToken(code));
        if (isBlank(userInfo.getOpenId()) || isBlank(userInfo.getTenantKey())) {
            throw new BusinessException(40031, "飞书用户信息不完整");
        }
        User user = userService.upsertByFeishuUser(userInfo);
        return LoginRes.builder()
                .token(jwtUtil.generate(user.getId(), user.getHandle(), true))
                .user(userService.buildMe(user.getId()))
                .build();
    }

    private String getAppAccessToken() {
        Map<String, String> payload = new HashMap<>();
        payload.put("app_id", appId);
        payload.put("app_secret", appSecret);

        JsonNode result = postJson(APP_ACCESS_TOKEN_URL, payload, null);
        int code = result.path("code").asInt(-1);
        if (code != 0) {
            throw new BusinessException(40032, "获取飞书 app_access_token 失败: " + result.path("msg").asText("unknown"));
        }
        String token = result.path("app_access_token").asText();
        if (isBlank(token)) {
            throw new BusinessException(40032, "飞书响应缺少 app_access_token");
        }
        return token;
    }

    private String getAccessToken(String code) {
        if (isBlank(code)) {
            throw new BusinessException(40031, "飞书回调缺少 code");
        }

        Map<String, String> payload = new HashMap<>();
        payload.put("grant_type", "authorization_code");
        payload.put("code", code);

        JsonNode result = postJson(ACCESS_TOKEN_URL, payload, getAppAccessToken());
        int resultCode = result.path("code").asInt(-1);
        if (resultCode != 0) {
            throw new BusinessException(40032, "获取飞书 user_access_token 失败: " + result.path("msg").asText("unknown"));
        }
        String token = result.path("data").path("access_token").asText();
        if (isBlank(token)) {
            throw new BusinessException(40032, "飞书响应缺少 access_token");
        }
        return token;
    }

    private FeishuUserInfo getUserInfo(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(accessToken);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    USER_INFO_URL,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class
            );
            JsonNode result = objectMapper.readTree(response.getBody());
            int code = result.path("code").asInt(-1);
            if (code != 0) {
                throw new BusinessException(40032, "获取飞书用户信息失败: " + result.path("msg").asText("unknown"));
            }
            JsonNode data = result.path("data");
            return FeishuUserInfo.builder()
                    .openId(textOrNull(data, "open_id"))
                    .unionId(textOrNull(data, "union_id"))
                    .tenantKey(textOrNull(data, "tenant_key"))
                    .name(textOrNull(data, "name"))
                    .avatarUrl(textOrNull(data, "avatar_url"))
                    .email(textOrNull(data, "email"))
                    .mobile(textOrNull(data, "mobile"))
                    .build();
        } catch (BusinessException e) {
            throw e;
        } catch (RestClientException e) {
            log.warn("feishu user_info request failed: {}", e.getMessage());
            throw new BusinessException(40032, "请求飞书 API 失败");
        } catch (Exception e) {
            log.warn("feishu user_info parse failed: {}", e.getMessage());
            throw new BusinessException(40032, "解析飞书用户信息失败");
        }
    }

    private JsonNode postJson(String url, Map<String, String> payload, String bearerToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (!isBlank(bearerToken)) {
            headers.setBearerAuth(bearerToken);
        }
        try {
            ResponseEntity<String> response = restTemplate.postForEntity(
                    url,
                    new HttpEntity<>(payload, headers),
                    String.class
            );
            return objectMapper.readTree(response.getBody());
        } catch (RestClientException e) {
            log.warn("feishu api request failed: {}", e.getMessage());
            throw new BusinessException(40032, "请求飞书 API 失败");
        } catch (Exception e) {
            log.warn("feishu api response parse failed: {}", e.getMessage());
            throw new BusinessException(40032, "解析飞书 API 响应失败");
        }
    }

    private void requireConfigured() {
        if (isBlank(appId) || isBlank(appSecret) || isBlank(redirectUri)) {
            throw new BusinessException(40033, "飞书登录未配置");
        }
    }

    private static String textOrNull(JsonNode node, String field) {
        String value = node.path(field).asText(null);
        return isBlank(value) ? null : value;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    public record AuthUrlResult(String authUrl, String state) {}

    @Data
    @Builder
    public static class FeishuUserInfo {
        private String openId;
        private String unionId;
        private String tenantKey;
        private String name;
        private String avatarUrl;
        private String email;
        private String mobile;
    }
}
