package com.skillstack.auth.oauth.feishu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillstack.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class HttpFeishuAuthClient implements FeishuAuthClient {

    private static final String APP_ACCESS_TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public String getAppAccessToken(String appId, String appSecret) {
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

    @Override
    public String getUserAccessToken(String code, String appAccessToken, String tokenEndpoint) {
        Map<String, String> payload = new HashMap<>();
        payload.put("grant_type", "authorization_code");
        payload.put("code", code);
        JsonNode result = postJson(tokenEndpoint, payload, appAccessToken);
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

    @Override
    public FeishuUserProfile getUserProfile(String userAccessToken, String userinfoEndpoint) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(userAccessToken);
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    userinfoEndpoint,
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
            return new FeishuUserProfile(
                    textOrNull(data, "open_id"),
                    textOrNull(data, "union_id"),
                    textOrNull(data, "tenant_key"),
                    textOrNull(data, "name"),
                    textOrNull(data, "avatar_url"),
                    textOrNull(data, "email"),
                    textOrNull(data, "mobile")
            );
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

    private static String textOrNull(JsonNode node, String field) {
        String value = node.path(field).asText(null);
        return isBlank(value) ? null : value;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
