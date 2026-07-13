package com.skillstack.auth.oauth.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.auth.oauth.entity.UserOAuthIdentity;
import com.skillstack.auth.oauth.mapper.UserOAuthIdentityMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class OAuthIdentityService {

    private static final Pattern UNSAFE_CHARS = Pattern.compile("[^a-z0-9_]+");

    private final UserOAuthIdentityMapper identityMapper;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;

    public record OAuthProfile(
            String providerUserId,
            String unionId,
            String username,
            String name,
            String email,
            String avatarUrl,
            Object rawPayload
    ) {}

    @Transactional
    public User loginOrCreate(String provider, OAuthProfile profile) {
        UserOAuthIdentity identity = identityMapper.selectOne(
                Wrappers.<UserOAuthIdentity>lambdaQuery()
                        .eq(UserOAuthIdentity::getProvider, provider)
                        .eq(UserOAuthIdentity::getProviderUserId, profile.providerUserId()));

        if (identity != null) {
            updateSnapshot(identity, profile);
            identityMapper.updateById(identity);
            User user = userMapper.selectById(identity.getUserId());
            if (user != null) {
                user.setLastLogin(LocalDateTime.now());
                userMapper.updateById(user);
            }
            return user;
        }

        return createUser(provider, profile);
    }

    private User createUser(String provider, OAuthProfile profile) {
        User user = new User();
        user.setHandle(nextAvailableHandle(handleCandidate(provider, profile)));
        user.setName(firstNonBlank(profile.name(), profile.username(), provider + "_user"));
        user.setEmail(resolveEmail(provider, profile));
        user.setPlatformRole("USER");
        user.setStatus("ACTIVE");
        user.setJoinedAt(LocalDateTime.now());
        user.setLastLogin(LocalDateTime.now());
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        userMapper.insert(user);

        UserOAuthIdentity identity = new UserOAuthIdentity();
        identity.setUserId(user.getId());
        identity.setProvider(provider);
        identity.setProviderUserId(profile.providerUserId());
        identity.setUnionId(blankToNull(profile.unionId()));
        identity.setUsername(blankToNull(profile.username()));
        identity.setEmail(blankToNull(profile.email()));
        identity.setAvatarUrl(blankToNull(profile.avatarUrl()));
        identity.setRawPayload(serializePayload(profile.rawPayload()));
        identity.setCreatedAt(LocalDateTime.now());
        identity.setUpdatedAt(LocalDateTime.now());
        identityMapper.insert(identity);

        return user;
    }

    private void updateSnapshot(UserOAuthIdentity identity, OAuthProfile profile) {
        identity.setUsername(blankToNull(profile.username()));
        identity.setEmail(blankToNull(profile.email()));
        identity.setAvatarUrl(blankToNull(profile.avatarUrl()));
        identity.setRawPayload(serializePayload(profile.rawPayload()));
        identity.setUpdatedAt(LocalDateTime.now());
    }

    private String handleCandidate(String provider, OAuthProfile profile) {
        String raw;
        if ("feishu".equals(provider)) {
            String name = profile.name();
            if (!isBlank(name)) {
                raw = name.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "_");
                if (raw.isBlank() || raw.replace("_", "").isBlank()) {
                    raw = "feishu_" + profile.providerUserId().substring(0, Math.min(6, profile.providerUserId().length()));
                }
            } else {
                raw = "feishu_" + profile.providerUserId().substring(0, Math.min(6, profile.providerUserId().length()));
            }
        } else {
            raw = firstNonBlank(profile.username(), provider + "_" + profile.providerUserId());
        }
        return normalizeHandle(raw);
    }

    private String normalizeHandle(String input) {
        String normalized = UNSAFE_CHARS.matcher(input.trim().toLowerCase(Locale.ROOT)).replaceAll("_");
        normalized = normalized.replaceAll("_+", "_").replaceAll("^_+|_+$", "");
        if (normalized.length() < 3) {
            normalized = "usr_" + normalized;
        }
        if (normalized.length() > 24) {
            normalized = normalized.substring(0, 24).replaceAll("_+$", "");
        }
        return normalized.length() < 3 ? "oauth_user" : normalized;
    }

    private String nextAvailableHandle(String base) {
        if (!handleExists(base)) {
            return base;
        }
        for (int i = 2; i <= 1000; i++) {
            String candidate = appendSuffix(base, "_" + i);
            if (!handleExists(candidate)) {
                return candidate;
            }
        }
        return appendSuffix(base, "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
    }

    private String appendSuffix(String base, String suffix) {
        int maxBase = Math.max(3, 24 - suffix.length());
        String prefix = base.length() > maxBase ? base.substring(0, maxBase).replaceAll("_+$", "") : base;
        if (prefix.length() < 3) prefix = "usr";
        return prefix + suffix;
    }

    private boolean handleExists(String handle) {
        return userMapper.selectCount(Wrappers.<User>lambdaQuery().eq(User::getHandle, handle)) > 0;
    }

    private String resolveEmail(String provider, OAuthProfile profile) {
        String email = profile.email();
        if (!isBlank(email) && isValidEmail(email)) {
            String normalized = email.trim().toLowerCase(Locale.ROOT);
            if (userMapper.selectCount(Wrappers.<User>lambdaQuery().eq(User::getEmail, normalized)) == 0) {
                return normalized;
            }
        }
        String safeId = UNSAFE_CHARS.matcher(profile.providerUserId().toLowerCase(Locale.ROOT)).replaceAll("_");
        return provider + "_" + safeId + "@oauth.local";
    }

    private boolean isValidEmail(String email) {
        int at = email.indexOf('@');
        return at > 0 && at == email.lastIndexOf('@') && !email.endsWith("@");
    }

    private String serializePayload(Object raw) {
        if (raw == null) return null;
        if (raw instanceof String s) return s;
        try {
            return objectMapper.writeValueAsString(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v.trim();
        }
        return "";
    }
}
