package com.skillstack.auth.oauth.service;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.systemconfig.SystemConfigService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;

@Slf4j
@Component
public class OAuthStateStore {

    private static final String CONFIG_KEY = "oauth.state_secret";

    private final String configuredSecret;
    private final long stateTtlSeconds;
    private final SystemConfigService systemConfigService;
    private final SecureRandom secureRandom = new SecureRandom();

    private volatile String resolvedSecret;

    public OAuthStateStore(
            @Value("${app.oauth.state-secret:}") String configuredSecret,
            @Value("${app.oauth.state-ttl-seconds:600}") long stateTtlSeconds,
            SystemConfigService systemConfigService) {
        this.configuredSecret = configuredSecret == null ? "" : configuredSecret.trim();
        this.stateTtlSeconds = stateTtlSeconds <= 0 ? 600 : stateTtlSeconds;
        this.systemConfigService = systemConfigService;
    }

    public String generate(String returnTo) {
        String secret = secret();
        String safeReturnTo = returnTo == null || returnTo.isBlank() ? "/" : returnTo.trim();
        String returnToPart = base64Url(safeReturnTo.getBytes(StandardCharsets.UTF_8));
        long expiresAt = Instant.now().getEpochSecond() + stateTtlSeconds;
        String nonce = randomToken();
        String payload = returnToPart + "." + expiresAt + "." + nonce;
        return payload + "." + sign(secret, payload);
    }

    public String verify(String state) {
        String secret = secret();
        if (state == null || state.isBlank()) {
            throw new BusinessException(40030, "OAuth state 无效");
        }
        String[] parts = state.split("\\.", -1);
        if (parts.length != 4) {
            throw new BusinessException(40030, "OAuth state 格式错误");
        }
        String payload = parts[0] + "." + parts[1] + "." + parts[2];
        if (!MessageDigest.isEqual(
                sign(secret, payload).getBytes(StandardCharsets.UTF_8),
                parts[3].getBytes(StandardCharsets.UTF_8))) {
            throw new BusinessException(40030, "OAuth state 签名错误");
        }
        long expiresAt;
        try {
            expiresAt = Long.parseLong(parts[1]);
        } catch (NumberFormatException e) {
            throw new BusinessException(40030, "OAuth state 格式错误");
        }
        if (Instant.now().getEpochSecond() > expiresAt) {
            throw new BusinessException(40030, "OAuth state 已过期");
        }
        try {
            return new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new BusinessException(40030, "OAuth state returnTo 解码失败");
        }
    }

    public boolean isConfigured() {
        return true;
    }

    /**
     * 解析 state HMAC secret：env 显式配置优先；否则从 system_config 读取，
     * 首次缺失时生成 64 字节随机串并持久化，保证重启后稳定且无需人工配置。
     */
    private String secret() {
        if (!configuredSecret.isEmpty()) {
            return configuredSecret;
        }
        String cached = resolvedSecret;
        if (cached != null) {
            return cached;
        }
        synchronized (this) {
            if (resolvedSecret == null) {
                resolvedSecret = systemConfigService.getOrInit(CONFIG_KEY, this::randomSecret);
                log.info("OAuth state secret loaded from system_config (auto-generated if absent)");
            }
            return resolvedSecret;
        }
    }

    private String sign(String secret, String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return base64Url(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Unable to sign OAuth state", e);
        }
    }

    private String randomSecret() {
        byte[] bytes = new byte[48];
        secureRandom.nextBytes(bytes);
        return base64Url(bytes);
    }

    private String randomToken() {
        byte[] bytes = new byte[24];
        secureRandom.nextBytes(bytes);
        return base64Url(bytes);
    }

    private String base64Url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
