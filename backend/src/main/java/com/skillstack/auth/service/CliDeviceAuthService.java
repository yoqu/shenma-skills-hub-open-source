package com.skillstack.auth.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.skillstack.auth.dto.CliDeviceInitRes;
import com.skillstack.auth.dto.CliDeviceLookupRes;
import com.skillstack.auth.dto.CliDevicePollRes;
import com.skillstack.auth.dto.CliWebInfoRes;
import com.skillstack.auth.entity.CliDeviceAuth;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.CliDeviceAuthMapper;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;

/**
 * CLI 设备授权流程：
 *  1. CLI POST /api/auth/cli/device-init 拿到 {deviceCode, userCode, verificationUri}
 *  2. CLI 打开浏览器到 verificationUri，用户在 web 上登录并审批
 *  3. CLI 用 deviceCode 轮询 /api/auth/cli/device-poll，状态变为 approved 后拿到 JWT
 *
 * 注意：deviceCode 只发给 CLI，绝不能在 URL/UI 上暴露；userCode 可以人眼可读。
 */
@Service
@RequiredArgsConstructor
public class CliDeviceAuthService {

    private static final SecureRandom RNG = new SecureRandom();
    // No ambiguous chars (0/O/1/I) so the user can read it out of the URL.
    private static final char[] USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final long DEFAULT_TTL_SECONDS = 600;
    private static final int POLL_INTERVAL_SECONDS = 2;

    private final CliDeviceAuthMapper mapper;
    private final UserMapper userMapper;
    private final UserService userService;
    private final JwtUtil jwtUtil;

    @Value("${app.oauth.frontend-origin:http://localhost:5173}")
    private String webBaseUrl;

    public CliWebInfoRes webInfo() {
        return CliWebInfoRes.builder()
                .webBaseUrl(stripTrailingSlash(webBaseUrl))
                .tokenPagePath("/profile/cli-token")
                .verifyPagePath("/cli-auth")
                .build();
    }

    @Transactional
    public CliDeviceInitRes initDevice(String userAgent) {
        String deviceCode = randomHex(32);
        String userCode = generateUniqueUserCode();
        CliDeviceAuth row = new CliDeviceAuth();
        row.setDeviceCode(deviceCode);
        row.setUserCode(userCode);
        row.setStatus("PENDING");
        row.setRemember(false);
        row.setUserAgent(userAgent);
        row.setExpiresAt(LocalDateTime.now().plus(Duration.ofSeconds(DEFAULT_TTL_SECONDS)));
        mapper.insert(row);
        return CliDeviceInitRes.builder()
                .deviceCode(deviceCode)
                .userCode(userCode)
                .verificationUri(stripTrailingSlash(webBaseUrl) + "/cli-auth?code=" + userCode)
                .expiresIn(DEFAULT_TTL_SECONDS)
                .interval(POLL_INTERVAL_SECONDS)
                .build();
    }

    @Transactional
    public CliDevicePollRes pollDevice(String deviceCode) {
        CliDeviceAuth row = mapper.selectOne(new LambdaQueryWrapper<CliDeviceAuth>()
                .eq(CliDeviceAuth::getDeviceCode, deviceCode));
        if (row == null) throw new BusinessException(40404, "无效的 device code");
        row.setLastPolledAt(LocalDateTime.now());
        if (isExpired(row) && !"APPROVED".equals(row.getStatus())) {
            row.setStatus("EXPIRED");
            mapper.updateById(row);
            throw new BusinessException(40410, "授权请求已过期，请重新发起");
        }
        switch (row.getStatus()) {
            case "DENIED":
                mapper.updateById(row);
                throw new BusinessException(40310, "授权请求已被拒绝");
            case "EXPIRED":
                mapper.updateById(row);
                throw new BusinessException(40410, "授权请求已过期，请重新发起");
            case "CONSUMED":
                mapper.updateById(row);
                throw new BusinessException(40310, "授权请求已经使用过");
            case "APPROVED": {
                String token = row.getToken();
                User user = row.getUserId() == null ? null : userMapper.selectById(row.getUserId());
                row.setStatus("CONSUMED");
                row.setToken(null);
                row.setConsumedAt(LocalDateTime.now());
                mapper.updateById(row);
                return CliDevicePollRes.builder()
                        .status("approved")
                        .token(token)
                        .user(user == null ? null : userService.buildMe(user.getId()))
                        .build();
            }
            case "PENDING":
            default:
                mapper.updateById(row);
                return CliDevicePollRes.builder().status("pending").build();
        }
    }

    public CliDeviceLookupRes lookup(String userCode) {
        CliDeviceAuth row = requirePendingByUserCode(userCode);
        long ttl = Math.max(0, Duration.between(LocalDateTime.now(), row.getExpiresAt()).getSeconds());
        return CliDeviceLookupRes.builder()
                .userCode(row.getUserCode())
                .status(row.getStatus())
                .expiresIn(ttl)
                .userAgent(row.getUserAgent())
                .build();
    }

    @Transactional
    public void approve(String userCode, Long userId, boolean remember) {
        CliDeviceAuth row = requirePendingByUserCode(userCode);
        User user = userMapper.selectById(userId);
        if (user == null) throw new BusinessException(40100, "未登录");
        String token = jwtUtil.generate(user.getId(), user.getHandle(), remember);
        row.setStatus("APPROVED");
        row.setUserId(user.getId());
        row.setToken(token);
        row.setRemember(remember);
        row.setApprovedAt(LocalDateTime.now());
        mapper.updateById(row);
    }

    @Transactional
    public void deny(String userCode, Long userId) {
        CliDeviceAuth row = requirePendingByUserCode(userCode);
        row.setStatus("DENIED");
        row.setUserId(userId);
        mapper.updateById(row);
    }

    private CliDeviceAuth requirePendingByUserCode(String userCode) {
        if (userCode == null || userCode.isBlank()) throw new BusinessException(40004, "授权码不能为空");
        CliDeviceAuth row = mapper.selectOne(new LambdaQueryWrapper<CliDeviceAuth>()
                .eq(CliDeviceAuth::getUserCode, userCode.toUpperCase()));
        if (row == null) throw new BusinessException(40404, "授权码不存在或已失效");
        if (isExpired(row)) {
            row.setStatus("EXPIRED");
            mapper.updateById(row);
            throw new BusinessException(40410, "授权请求已过期");
        }
        if (!"PENDING".equals(row.getStatus())) {
            throw new BusinessException(40020, "授权请求状态非待审批：" + row.getStatus());
        }
        return row;
    }

    private String generateUniqueUserCode() {
        for (int attempt = 0; attempt < 6; attempt++) {
            String candidate = randomUserCode();
            Long count = mapper.selectCount(new LambdaQueryWrapper<CliDeviceAuth>()
                    .eq(CliDeviceAuth::getUserCode, candidate));
            if (count == null || count == 0) return candidate;
        }
        throw new BusinessException(50000, "生成 user_code 失败，请重试");
    }

    private static boolean isExpired(CliDeviceAuth row) {
        return row.getExpiresAt() != null && row.getExpiresAt().isBefore(LocalDateTime.now());
    }

    private static String stripTrailingSlash(String s) {
        return s == null ? "" : s.replaceAll("/+$", "");
    }

    private static String randomHex(int byteLen) {
        byte[] buf = new byte[byteLen];
        RNG.nextBytes(buf);
        StringBuilder sb = new StringBuilder(byteLen * 2);
        for (byte b : buf) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private static String randomUserCode() {
        char[] out = new char[8];
        for (int i = 0; i < 8; i++) out[i] = USER_CODE_ALPHABET[RNG.nextInt(USER_CODE_ALPHABET.length)];
        return new String(out, 0, 4) + "-" + new String(out, 4, 4);
    }
}
