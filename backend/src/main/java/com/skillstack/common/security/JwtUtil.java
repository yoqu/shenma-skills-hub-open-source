package com.skillstack.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
public class JwtUtil {

    private final SecretKey key;
    private final long longTtlMillis;
    private final long shortTtlMillis;
    private final String issuer;

    public JwtUtil(
            @Value("${skillstack.jwt.secret}") String secret,
            @Value("${skillstack.jwt.ttl-seconds:604800}") long longTtlSeconds,
            @Value("${skillstack.jwt.short-ttl-seconds:14400}") long shortTtlSeconds,
            @Value("${skillstack.jwt.issuer:skillstack}") String issuer) {
        byte[] bytes;
        try {
            bytes = Decoders.BASE64.decode(secret);
            if (bytes.length < 32) {
                bytes = secret.getBytes(StandardCharsets.UTF_8);
            }
        } catch (Exception e) {
            bytes = secret.getBytes(StandardCharsets.UTF_8);
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.longTtlMillis = longTtlSeconds * 1000L;
        this.shortTtlMillis = shortTtlSeconds * 1000L;
        this.issuer = issuer;
    }

    /** 默认签发短期 token，4 小时左右。 */
    public String generate(Long userId, String handle) {
        return generate(userId, handle, false);
    }

    /**
     * 是否签发 "7 天免登录" 长期 token（AUTH-009）。
     * remember=true 时 TTL = ttl-seconds（默认 7d），否则 short-ttl-seconds（默认 4h）。
     */
    public String generate(Long userId, String handle, boolean remember) {
        long now = System.currentTimeMillis();
        long ttl = remember ? longTtlMillis : shortTtlMillis;
        Map<String, Object> claims = new HashMap<>();
        claims.put("handle", handle);
        claims.put("rmb", remember);
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .issuer(issuer)
                .issuedAt(new Date(now))
                .expiration(new Date(now + ttl))
                .claims(claims)
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean validate(String token) {
        try {
            parse(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("invalid jwt: {}", e.getMessage());
            return false;
        }
    }
}
