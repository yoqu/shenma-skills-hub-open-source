package com.skillstack.token.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.token.dto.CreateTokenReq;
import com.skillstack.token.dto.CreateTokenRes;
import com.skillstack.token.dto.TokenItemRes;
import com.skillstack.token.entity.PersonalAccessToken;
import com.skillstack.token.mapper.PersonalAccessTokenMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PersonalAccessTokenService {

    private static final String PREFIX = "lst_";
    private static final String ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int SECRET_LEN = 32;
    private static final SecureRandom RNG = new SecureRandom();

    private final PersonalAccessTokenMapper mapper;
    private final TeamAccessGuard guard;

    public List<TokenItemRes> list(Long teamId, Long userId) {
        guard.requireMember(teamId, userId);
        List<PersonalAccessToken> rows = mapper.selectList(new LambdaQueryWrapper<PersonalAccessToken>()
                .eq(PersonalAccessToken::getTeamId, teamId)
                .eq(PersonalAccessToken::getUserId, userId)
                .orderByDesc(PersonalAccessToken::getCreatedAt));
        return rows.stream().map(this::toItem).toList();
    }

    @Transactional
    public CreateTokenRes create(Long teamId, Long userId, CreateTokenReq req) {
        guard.requireMember(teamId, userId);
        String secret = PREFIX + randomSecret(SECRET_LEN);
        String hash = sha256Hex(secret);
        String prefixVisible = secret.substring(0, PREFIX.length() + 8);
        PersonalAccessToken row = new PersonalAccessToken();
        row.setUserId(userId);
        row.setTeamId(teamId);
        row.setName(req.getName().trim());
        row.setKind(req.getKind() == null ? "personal" : req.getKind());
        row.setTokenPrefix(prefixVisible);
        row.setTokenHash(hash);
        mapper.insert(row);
        return CreateTokenRes.builder()
                .id(row.getId())
                .name(row.getName())
                .kind(row.getKind())
                .secret(secret)
                .masked(mask(prefixVisible))
                .build();
    }

    @Transactional
    public void revoke(Long teamId, Long userId, Long tokenId) {
        guard.requireMember(teamId, userId);
        PersonalAccessToken row = mapper.selectById(tokenId);
        if (row == null || !row.getTeamId().equals(teamId) || !row.getUserId().equals(userId)) {
            throw new BusinessException(40400, "Token 不存在");
        }
        if (row.getRevokedAt() != null) return;
        row.setRevokedAt(LocalDateTime.now());
        mapper.updateById(row);
    }

    @Transactional
    public void revokeAllForUserInTeam(Long teamId, Long userId) {
        List<PersonalAccessToken> rows = mapper.selectList(new LambdaQueryWrapper<PersonalAccessToken>()
                .eq(PersonalAccessToken::getTeamId, teamId)
                .eq(PersonalAccessToken::getUserId, userId)
                .isNull(PersonalAccessToken::getRevokedAt));
        LocalDateTime now = LocalDateTime.now();
        for (PersonalAccessToken r : rows) {
            r.setRevokedAt(now);
            mapper.updateById(r);
        }
    }

    /**
     * Resolve a secret to an active token; updates last_used_at.
     * Returns null if not found or revoked.
     */
    @Transactional
    public PersonalAccessToken resolveActive(String secret) {
        if (secret == null || !secret.startsWith(PREFIX)) return null;
        String hash = sha256Hex(secret);
        PersonalAccessToken row = mapper.selectOne(new LambdaQueryWrapper<PersonalAccessToken>()
                .eq(PersonalAccessToken::getTokenHash, hash));
        if (row == null || row.getRevokedAt() != null) return null;
        row.setLastUsedAt(LocalDateTime.now());
        mapper.updateById(row);
        return row;
    }

    private TokenItemRes toItem(PersonalAccessToken r) {
        return TokenItemRes.builder()
                .id(r.getId())
                .name(r.getName())
                .kind(r.getKind())
                .masked(mask(r.getTokenPrefix()))
                .lastUsedAt(r.getLastUsedAt())
                .lastUsedIp(r.getLastUsedIp())
                .createdAt(r.getCreatedAt())
                .revokedAt(r.getRevokedAt())
                .build();
    }

    private static String mask(String prefix) {
        return prefix + "••••••••••••••••";
    }

    private static String randomSecret(int n) {
        StringBuilder sb = new StringBuilder(n);
        for (int i = 0; i < n; i++) sb.append(ALPHABET.charAt(RNG.nextInt(ALPHABET.length())));
        return sb.toString();
    }

    private static String sha256Hex(String s) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
