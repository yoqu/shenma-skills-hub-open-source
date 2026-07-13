package com.skillstack.auth.sms;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillstack.admin.service.AuditLogService;
import com.skillstack.auth.sms.dto.AdminSmsProviderVO;
import com.skillstack.auth.sms.dto.UpdateSmsProviderReq;
import com.skillstack.auth.sms.entity.SmsProviderConfig;
import com.skillstack.auth.sms.mapper.SmsProviderConfigMapper;
import com.skillstack.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SmsProviderService {

    public static final String DEFAULT_CODE = "sms_login";
    public static final String PROVIDER_HTTP = "HTTP";
    public static final String PROVIDER_LINGYANG_CHAOXIN = "LINGYANG_CHAOXIN";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final TypeReference<List<Map<String, Object>>> HEADER_LIST = new TypeReference<>() {};
    private static final TypeReference<Map<String, Object>> OBJECT_MAP = new TypeReference<>() {};

    private final SmsProviderConfigMapper mapper;
    private final AuditLogService auditLogService;


    public AdminSmsProviderVO getAdmin() {
        return toAdminVO(getOrInit());
    }

    public Optional<SmsProviderConfig> getEnabledConfig() {
        SmsProviderConfig config = getOrInit();
        if (!Boolean.TRUE.equals(config.getEnabled())) {
            return Optional.empty();
        }
        requireConfigured(config);
        return Optional.of(config);
    }

    public AdminSmsProviderVO update(UpdateSmsProviderReq req, Long actorId) {
        SmsProviderConfig existing = getOrInit();
        Map<String, Object> before = snapshotForAudit(existing);

        if (req.getDisplayName() != null) existing.setDisplayName(blankToDefault(req.getDisplayName(), "短信验证码"));
        if (req.getEnabled() != null) existing.setEnabled(req.getEnabled());
        if (req.getProviderType() != null) existing.setProviderType(normalizeProviderType(req.getProviderType()));
        if (req.getEndpointUrl() != null) existing.setEndpointUrl(blankToNull(req.getEndpointUrl()));
        if (req.getMethod() != null) existing.setMethod(blankToDefault(req.getMethod(), "POST").toUpperCase());
        if (req.getHeadersJson() != null) existing.setHeadersJson(mergeHeaders(existing.getHeadersJson(), req.getHeadersJson()));
        if (req.getBodyTemplate() != null) existing.setBodyTemplate(blankToNull(req.getBodyTemplate()));
        if (req.getSuccessStatus() != null) existing.setSuccessStatus(req.getSuccessStatus());
        if (req.getSuccessJsonPath() != null) existing.setSuccessJsonPath(blankToNull(req.getSuccessJsonPath()));
        if (req.getSuccessExpectedValue() != null) existing.setSuccessExpectedValue(blankToNull(req.getSuccessExpectedValue()));
        if (req.getExtraJson() != null) existing.setExtraJson(blankToNull(req.getExtraJson()));

        boolean secretJsonChanged = req.getSecretJson() != null;
        if (secretJsonChanged) {
            existing.setSecretJson(mergeSecretJson(existing.getSecretJson(), req.getSecretJson()));
        }

        if (Boolean.TRUE.equals(existing.getEnabled())) {
            requireConfigured(existing);
        }

        existing.setUpdatedBy(actorId);
        mapper.updateById(existing);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("before", before);
        payload.put("after", snapshotForAudit(existing));
        payload.put("secretJsonChanged", secretJsonChanged);
        auditLogService.record(actorId, "sms.provider.update", "sms_provider_config", null, payload);

        return toAdminVO(existing);
    }

    private SmsProviderConfig getOrInit() {
        SmsProviderConfig config = mapper.selectById(DEFAULT_CODE);
        if (config != null) {
            return config;
        }
        SmsProviderConfig created = defaultConfig();
        mapper.insert(created);
        return created;
    }

    private SmsProviderConfig defaultConfig() {
        SmsProviderConfig config = new SmsProviderConfig();
        config.setCode(DEFAULT_CODE);
        config.setDisplayName("短信验证码");
        config.setEnabled(false);
        config.setProviderType(PROVIDER_HTTP);
        config.setMethod("POST");
        config.setSuccessStatus(200);
        return config;
    }

    private void requireConfigured(SmsProviderConfig config) {
        String providerType = normalizeProviderType(config.getProviderType());
        if (PROVIDER_HTTP.equals(providerType)) {
            requireHttpConfigured(config);
            return;
        }
        if (PROVIDER_LINGYANG_CHAOXIN.equals(providerType)) {
            requireLingyangConfigured(config);
            return;
        }
        throw new BusinessException(40040, "短信供应商配置不完整");
    }

    private void requireHttpConfigured(SmsProviderConfig config) {
        if (isBlank(config.getEndpointUrl()) || isBlank(config.getBodyTemplate())) {
            throw new BusinessException(40040, "短信供应商配置不完整");
        }
    }

    private void requireLingyangConfigured(SmsProviderConfig config) {
        Map<String, Object> extra = readObject(config.getExtraJson());
        Map<String, Object> secret = readObject(config.getSecretJson());
        if (isBlank(config.getEndpointUrl())
                || isBlank(stringValue(extra.get("appId")))
                || isBlank(stringValue(extra.get("accessKey")))
                || isBlank(stringValue(extra.get("signName")))
                || isBlank(stringValue(extra.get("templateCode")))
                || isBlank(stringValue(secret.get("accessSecret")))) {
            throw new BusinessException(40040, "短信供应商配置不完整");
        }
    }

    private AdminSmsProviderVO toAdminVO(SmsProviderConfig config) {
        return AdminSmsProviderVO.builder()
                .code(config.getCode())
                .displayName(config.getDisplayName())
                .enabled(config.getEnabled())
                .providerType(config.getProviderType())
                .endpointUrl(config.getEndpointUrl())
                .method(config.getMethod())
                .headersJson(maskHeaders(config.getHeadersJson()))
                .bodyTemplate(config.getBodyTemplate())
                .successStatus(config.getSuccessStatus())
                .successJsonPath(config.getSuccessJsonPath())
                .successExpectedValue(config.getSuccessExpectedValue())
                .extraJson(config.getExtraJson())
                .secretJson(maskSecretJson(config.getSecretJson()))
                .secretJsonSet(!isBlank(config.getSecretJson()))
                .updatedAt(config.getUpdatedAt())
                .build();
    }

    private Map<String, Object> snapshotForAudit(SmsProviderConfig config) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", config.getCode());
        m.put("displayName", config.getDisplayName());
        m.put("enabled", config.getEnabled());
        m.put("providerType", config.getProviderType());
        m.put("endpointUrl", config.getEndpointUrl());
        m.put("method", config.getMethod());
        m.put("headersJson", maskHeaders(config.getHeadersJson()));
        m.put("bodyTemplate", config.getBodyTemplate());
        m.put("successStatus", config.getSuccessStatus());
        m.put("successJsonPath", config.getSuccessJsonPath());
        m.put("successExpectedValue", config.getSuccessExpectedValue());
        m.put("extraJson", config.getExtraJson());
        m.put("secretJsonSet", !isBlank(config.getSecretJson()));
        return m;
    }

    private String normalizeProviderType(String providerType) {
        String value = blankToDefault(providerType, PROVIDER_HTTP).toUpperCase();
        if (!PROVIDER_HTTP.equals(value) && !PROVIDER_LINGYANG_CHAOXIN.equals(value)) {
            throw new BusinessException(40040, "短信供应商配置不完整");
        }
        return value;
    }

    private String mergeHeaders(String existingJson, String incomingJson) {
        if (incomingJson.isBlank()) {
            return null;
        }
        List<Map<String, Object>> existingHeaders = readHeaders(existingJson);
        List<Map<String, Object>> incomingHeaders = readHeaders(incomingJson);
        Map<String, String> existingSecretValues = new LinkedHashMap<>();
        for (Map<String, Object> header : existingHeaders) {
            if (isSecretHeader(header)) {
                existingSecretValues.put(stringValue(header.get("name")), stringValue(header.get("value")));
            }
        }

        List<Map<String, Object>> merged = new ArrayList<>();
        for (Map<String, Object> header : incomingHeaders) {
            Map<String, Object> item = new LinkedHashMap<>();
            String name = stringValue(header.get("name"));
            String value = stringValue(header.get("value"));
            boolean secret = isSecretHeader(header);
            item.put("name", name);
            if (secret && isBlank(value) && Boolean.TRUE.equals(header.get("valueSet"))) {
                item.put("value", existingSecretValues.get(name));
            } else {
                item.put("value", value);
            }
            item.put("secret", secret);
            if (!isBlank(stringValue(header.get("description")))) {
                item.put("description", stringValue(header.get("description")));
            }
            if (!isBlank(name)) {
                merged.add(item);
            }
        }
        return writeJson(merged);
    }

    private String maskHeaders(String headersJson) {
        List<Map<String, Object>> headers = readHeaders(headersJson);
        List<Map<String, Object>> masked = new ArrayList<>();
        for (Map<String, Object> header : headers) {
            Map<String, Object> item = new LinkedHashMap<>(header);
            if (isSecretHeader(header)) {
                item.put("value", "");
                item.put("valueSet", !isBlank(stringValue(header.get("value"))));
            }
            masked.add(item);
        }
        return masked.isEmpty() ? null : writeJson(masked);
    }

    private String mergeSecretJson(String existingJson, String incomingJson) {
        if (incomingJson.isBlank()) {
            return null;
        }
        Map<String, Object> existing = readObject(existingJson);
        Map<String, Object> incoming = readObject(incomingJson);
        Map<String, Object> merged = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : incoming.entrySet()) {
            String key = entry.getKey();
            String value = stringValue(entry.getValue());
            if (isBlank(value) && Boolean.TRUE.equals(incoming.get(key + "Set"))) {
                merged.put(key, existing.get(key));
            } else if (!key.endsWith("Set")) {
                merged.put(key, value);
            }
        }
        return merged.isEmpty() ? null : writeJson(merged);
    }

    private String maskSecretJson(String secretJson) {
        Map<String, Object> secret = readObject(secretJson);
        if (secret.isEmpty()) {
            return null;
        }
        Map<String, Object> masked = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : secret.entrySet()) {
            masked.put(entry.getKey(), "");
            masked.put(entry.getKey() + "Set", !isBlank(stringValue(entry.getValue())));
        }
        return writeJson(masked);
    }

    private List<Map<String, Object>> readHeaders(String headersJson) {
        if (isBlank(headersJson)) {
            return List.of();
        }
        try {
            return JSON.readValue(headersJson, HEADER_LIST);
        } catch (Exception e) {
            throw new BusinessException(40040, "短信供应商配置不完整");
        }
    }

    private Map<String, Object> readObject(String json) {
        if (isBlank(json)) {
            return Map.of();
        }
        try {
            return JSON.readValue(json, OBJECT_MAP);
        } catch (Exception e) {
            throw new BusinessException(40040, "短信供应商配置不完整");
        }
    }

    private String writeJson(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (Exception e) {
            throw new BusinessException(40040, "短信供应商配置不完整");
        }
    }

    private boolean isSecretHeader(Map<String, Object> header) {
        return Boolean.TRUE.equals(header.get("secret")) || "SECRET".equalsIgnoreCase(stringValue(header.get("type")));
    }

    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String blankToDefault(String s, String fallback) {
        return s == null || s.isBlank() ? fallback : s.trim();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
