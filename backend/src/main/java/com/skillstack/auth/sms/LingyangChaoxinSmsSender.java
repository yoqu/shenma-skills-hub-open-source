package com.skillstack.auth.sms;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillstack.auth.sms.entity.SmsProviderConfig;
import com.skillstack.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class LingyangChaoxinSmsSender {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> OBJECT_MAP = new TypeReference<>() {};
    private static final String SEND_PATH = "/openapi/cloud/userMarketing/sendSms";

    private final RestTemplate restTemplate;


    public void send(SmsProviderConfig config, String phone, String code, String purpose, long ttlSeconds) {
        Map<String, Object> extra = readObject(config.getExtraJson());
        Map<String, Object> secret = readObject(config.getSecretJson());

        String endpointUrl = trimTrailingSlash(config.getEndpointUrl()) + SEND_PATH;
        String appId = required(extra, "appId");
        String accessKey = required(extra, "accessKey");
        String accessSecret = required(secret, "accessSecret");
        long timestamp = System.currentTimeMillis();
        String url = endpointUrl + "?appId=" + appId + "&accessKey=" + accessKey + "&timestamp=" + timestamp;
        String authorization = LingyangChaoxinSignatureUtil.generateSignature(
                appId,
                accessKey,
                accessSecret,
                timestamp,
                null
        );

        Map<String, Object> body = buildBody(extra, phone, code);
        RestTemplate requestRestTemplate = buildRestTemplate(extra);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", authorization);

        int maxRetry = intValue(extra.get("maxRetry"), 1);
        int attempts = Math.max(maxRetry, 1);
        Exception lastException = null;
        for (int i = 0; i < attempts; i++) {
            try {
                ResponseEntity<String> response = requestRestTemplate.exchange(
                        url,
                        HttpMethod.POST,
                        new HttpEntity<>(JSON.writeValueAsString(body), headers),
                        String.class
                );
                LingyangSmsResponse smsResponse = parseResponse(response);
                if (smsResponse.isSuccess()) {
                    return;
                }
                log.warn("lingyang chaoxin sms response failed: code={}, message={}",
                        smsResponse.code(), smsResponse.message());
                throw new BusinessException(40041, "短信发送失败，请稍后重试");
            } catch (BusinessException e) {
                throw e;
            } catch (Exception e) {
                lastException = e;
            }
        }

        log.warn("lingyang chaoxin sms request failed: {}", lastException == null ? "" : lastException.getMessage());
        throw new BusinessException(40041, "短信发送失败，请稍后重试");
    }

    private RestTemplate buildRestTemplate(Map<String, Object> extra) {
        int timeout = intValue(extra.get("timeout"), 0);
        if (timeout <= 0) {
            return restTemplate;
        }
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(timeout);
        factory.setReadTimeout(timeout);
        return new RestTemplate(factory);
    }

    private Map<String, Object> buildBody(Map<String, Object> extra, String phone, String code) {
        String paramKey = stringValue(extra.get("templateParamKey"));
        if (paramKey == null || paramKey.isBlank()) {
            paramKey = "code";
        }

        Map<String, String> templateParam = new LinkedHashMap<>();
        templateParam.put(paramKey, code);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("phoneNumbers", List.of(phone));
        body.put("signName", required(extra, "signName"));
        body.put("templateCode", required(extra, "templateCode"));
        body.put("templateParam", templateParam);
        String smsReport = stringValue(extra.get("smsReport"));
        if (smsReport != null && !smsReport.isBlank()) {
            body.put("smsReport", smsReport);
        }
        return body;
    }

    private LingyangSmsResponse parseResponse(ResponseEntity<String> response) throws Exception {
        if (response.getStatusCode().value() != 200) {
            throw new BusinessException(40041, "短信发送失败，请稍后重试");
        }

        JsonNode outer = JSON.readTree(response.getBody() == null ? "{}" : response.getBody());
        JsonNode dataNode = outer.get("data");
        if (dataNode == null || dataNode.isNull()) {
            throw new BusinessException(40041, "短信发送失败，请稍后重试");
        }

        JsonNode inner = dataNode.isTextual() ? JSON.readTree(dataNode.asText()) : dataNode;
        return new LingyangSmsResponse(
                inner.path("code").asText(null),
                inner.path("message").asText(null),
                inner.path("requestId").asText(null),
                inner.path("bizId").asText(null)
        );
    }

    private Map<String, Object> readObject(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return JSON.readValue(json, OBJECT_MAP);
        } catch (Exception e) {
            throw new BusinessException(40040, "短信供应商配置不完整");
        }
    }

    private String required(Map<String, Object> map, String key) {
        String value = stringValue(map.get(key));
        if (value == null || value.isBlank()) {
            throw new BusinessException(40040, "短信供应商配置不完整");
        }
        return value;
    }

    private int intValue(Object value, int fallback) {
        if (value == null) {
            return fallback;
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private String trimTrailingSlash(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private record LingyangSmsResponse(String code, String message, String requestId, String bizId) {
        private boolean isSuccess() {
            return "OK".equals(code);
        }
    }
}
