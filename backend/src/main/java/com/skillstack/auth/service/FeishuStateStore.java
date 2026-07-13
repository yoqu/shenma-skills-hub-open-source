package com.skillstack.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class FeishuStateStore {

    private final SecureRandom random = new SecureRandom();
    private final Map<String, Long> states = new ConcurrentHashMap<>();
    private final long ttlSeconds;

    public FeishuStateStore(@Value("${skillstack.feishu.state-ttl-seconds:600}") long ttlSeconds) {
        this.ttlSeconds = ttlSeconds;
    }

    public String generate() {
        cleanupExpired();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String state = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        states.put(state, Instant.now().getEpochSecond() + ttlSeconds);
        return state;
    }

    public boolean verifyAndConsume(String state) {
        if (state == null || state.isBlank()) {
            return false;
        }
        Long expiresAt = states.remove(state);
        return expiresAt != null && expiresAt >= Instant.now().getEpochSecond();
    }

    private void cleanupExpired() {
        long now = Instant.now().getEpochSecond();
        states.entrySet().removeIf(entry -> entry.getValue() < now);
    }
}
