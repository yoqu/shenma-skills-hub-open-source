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
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class HttpSmsSender {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final TypeReference<List<Map<String, Object>>> HEADER_LIST = new TypeReference<>() {};

    private final RestTemplate restTemplate;


    public void send(SmsProviderConfig config, String phone, String code, String purpose, long ttlSeconds) {
        try {
            HttpHeaders headers = new HttpHeaders();
            applyHeaders(headers, config.getHeadersJson());

            String body = renderTemplate(config.getBodyTemplate(), phone, code, purpose, ttlSeconds);
            HttpMethod method = HttpMethod.valueOf(defaultString(config.getMethod(), "POST").toUpperCase());
            ResponseEntity<String> response = restTemplate.exchange(
                    config.getEndpointUrl(),
                    method,
                    new HttpEntity<>(body, headers),
                    String.class
            );
            verifyResponse(config, response);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("sms provider request failed: {}", e.getMessage());
            throw new BusinessException(40041, "短信发送失败，请稍后重试");
        }
    }

    private void applyHeaders(HttpHeaders headers, String headersJson) throws Exception {
        if (headersJson == null || headersJson.isBlank()) {
            return;
        }
        List<Map<String, Object>> parsed = JSON.readValue(headersJson, HEADER_LIST);
        for (Map<String, Object> entry : parsed) {
            String name = stringValue(entry.get("name"));
            String value = stringValue(entry.get("value"));
            if (name != null && !name.isBlank() && value != null) {
                headers.set(name, value);
            }
        }
    }

    private String renderTemplate(String template, String phone, String code, String purpose, long ttlSeconds) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("phone", phone);
        values.put("code", code);
        values.put("purpose", purpose == null ? "" : purpose);
        values.put("ttlSeconds", String.valueOf(ttlSeconds));

        String rendered = template;
        for (Map.Entry<String, String> entry : values.entrySet()) {
            rendered = rendered.replace("${" + entry.getKey() + "}", jsonEscape(entry.getValue()));
        }
        return rendered;
    }

    private void verifyResponse(SmsProviderConfig config, ResponseEntity<String> response) throws Exception {
        int expectedStatus = config.getSuccessStatus() == null ? 200 : config.getSuccessStatus();
        if (response.getStatusCode().value() != expectedStatus) {
            throw new BusinessException(40041, "短信发送失败，请稍后重试");
        }
        if (config.getSuccessJsonPath() == null || config.getSuccessJsonPath().isBlank()) {
            return;
        }

        JsonNode node = JSON.readTree(response.getBody() == null ? "{}" : response.getBody());
        for (String part : config.getSuccessJsonPath().split("\\.")) {
            if (part.isBlank()) {
                continue;
            }
            node = node == null ? null : node.get(part);
        }
        String actual = node == null || node.isMissingNode() ? null : node.asText();
        if (!defaultString(config.getSuccessExpectedValue(), "true").equals(actual)) {
            throw new BusinessException(40041, "短信发送失败，请稍后重试");
        }
    }

    private static String jsonEscape(String raw) {
        return raw.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static String defaultString(String s, String fallback) {
        return s == null || s.isBlank() ? fallback : s;
    }

    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
