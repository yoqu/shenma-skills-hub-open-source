package com.skillstack.auth.service;

import com.skillstack.auth.dto.LoginReq;
import com.skillstack.auth.dto.LoginRes;
import com.skillstack.auth.dto.RegisterStep1Req;
import com.skillstack.auth.dto.RegisterStep2Req;
import com.skillstack.auth.dto.RegisterStep3Req;
import com.skillstack.auth.dto.RegisterStep4Req;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.sms.SmsSenderDispatcher;
import com.skillstack.auth.sms.SmsProviderService;
import com.skillstack.auth.sms.entity.SmsProviderConfig;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.JwtUtil;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.skillstack.team.service.InviteService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 认证服务：
 * - 短信验证码 mock（内存 Map 5 分钟过期，生产应替换为短信服务 + Redis）
 * - 登录：密码 OR 短信验证码
 * - 4 步注册：每步用 regToken（JWT，subject = "register:{phone}"）累积 claims
 *   step1: phone + smsCode → 签发 regToken（含 phone）
 *   step2: 校验 handle 唯一 → 累加 handle / name / passwordHash
 *   step3: 累加 avatar / bio（可选）
 *   step4: 写入 users 表 + 可选加入团队，返回正式 JWT + MeRes
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    /** 短信验证码 TTL，5 分钟。 */
    public static final long SMS_TTL_SECONDS = 300;
    /** 注册 token TTL，30 分钟（足够走完 4 步）。 */
    public static final long REG_TOKEN_TTL_SECONDS = 30 * 60;

    private final UserService userService;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final InviteService inviteService;
    private final SmsProviderService smsProviderService;
    private final SmsSenderDispatcher smsSenderDispatcher;

    @Value("${skillstack.jwt.secret}")
    private String jwtSecret;

    /** 注册 token 用独立的 key（同一份 secret），但 subject 加 register: 前缀避免和登录 token 串。 */
    private SecretKey regKey;

    /** 手机号 → (验证码, 过期时间)。生产应该塞 Redis，原型放内存够用。 */
    private final Map<String, SmsEntry> smsStore = new ConcurrentHashMap<>();
    private final SecureRandom secureRandom = new SecureRandom();

    @PostConstruct
    void init() {
        byte[] bytes;
        try {
            bytes = Decoders.BASE64.decode(jwtSecret);
            if (bytes.length < 32) {
                bytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
            }
        } catch (Exception e) {
            bytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        }
        this.regKey = Keys.hmacShaKeyFor(bytes);
    }

    // ------------------------------------------------------------
    // SMS
    // ------------------------------------------------------------

    public Map<String, Object> sendSmsCode(String phone, String purpose) {
        String normalizedPhone = normalizePhone(phone);
        // 按 purpose 预校验，避免给未注册手机号发登录验证码、或给已注册手机号发注册验证码。
        // 前端可以据此弹窗引导用户切换到正确的流程。
        if ("login".equals(purpose) && !userService.phoneExists(normalizedPhone)) {
            throw new BusinessException(40004, "手机号尚未注册");
        }
        if ("register".equals(purpose) && userService.phoneExists(normalizedPhone)) {
            throw new BusinessException(40020, "手机号已注册，请直接登录");
        }
        String code = String.format("%06d", secureRandom.nextInt(1_000_000));
        boolean sentByProvider = sendCodeByProvider(normalizedPhone, code, purpose);
        smsStore.put(normalizedPhone, new SmsEntry(code, System.currentTimeMillis() + SMS_TTL_SECONDS * 1000));
        if (!sentByProvider) {
            log.debug("dev sms code issued for {}: {}", normalizedPhone, code);
        }
        Map<String, Object> ret = new HashMap<>();
        ret.put("ttl", SMS_TTL_SECONDS);
        return ret;
    }

    /** 兼容旧调用，未指定 purpose。 */
    public Map<String, Object> sendSmsCode(String phone) {
        return sendSmsCode(phone, null);
    }

    /** 账号安全操作复用短信码校验：成功后一次性消费。 */
    public void verifySmsCodeForAccountChange(String phone, String code) {
        verifySmsCode(phone, code);
    }

    /** 校验短信码：必须先签发、未过期且匹配；成功后一次性消费。 */
    private void verifySmsCode(String phone, String code) {
        if (code == null || code.isBlank()) {
            throw new BusinessException(40010, "验证码不能为空");
        }
        String normalizedPhone = normalizePhone(phone);
        SmsEntry e = smsStore.get(normalizedPhone);
        if (e == null) {
            throw new BusinessException(40010, "请先获取验证码");
        }
        if (e.expireAt < System.currentTimeMillis()) {
            smsStore.remove(normalizedPhone);
            throw new BusinessException(40010, "验证码错误或已过期");
        }
        if (!e.code.equals(code.trim())) {
            throw new BusinessException(40010, "验证码错误或已过期");
        }
        smsStore.remove(normalizedPhone);
    }

    // ------------------------------------------------------------
    // Login
    // ------------------------------------------------------------

    public LoginRes login(LoginReq req) {
        User user;
        if (req.getPhone() != null && !req.getPhone().isBlank()
                && req.getSmsCode() != null && !req.getSmsCode().isBlank()) {
            // 短信登录
            verifySmsCode(req.getPhone(), req.getSmsCode());
            user = userService.findByPhone(normalizePhone(req.getPhone()));
            if (user == null) {
                throw new BusinessException(40001, "手机号未注册");
            }
        } else if (req.getIdentifier() != null && !req.getIdentifier().isBlank()
                && req.getPassword() != null && !req.getPassword().isBlank()) {
            // 密码登录
            user = userService.findByIdentifier(req.getIdentifier());
            if (user == null || !passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
                throw new BusinessException(40001, "账号或密码错误");
            }
        } else {
            throw new BusinessException(40001, "缺少登录凭据");
        }

        if (user.getStatus() != null && "DISABLED".equals(user.getStatus())) {
            throw new BusinessException(40300, "该账号已被禁用，请联系平台管理员");
        }

        String token = jwtUtil.generate(user.getId(), user.getHandle(), Boolean.TRUE.equals(req.getRemember()));
        return LoginRes.builder()
                .token(token)
                .user(userService.buildMe(user.getId()))
                .build();
    }

    // ------------------------------------------------------------
    // Register: 4 steps
    // ------------------------------------------------------------

    public Map<String, Object> registerStep1(RegisterStep1Req req) {
        String phone = normalizePhone(req.getPhone());
        verifySmsCode(phone, req.getSmsCode());
        if (userService.phoneExists(phone)) {
            throw new BusinessException(40020, "手机号已注册，请直接登录");
        }
        Map<String, Object> claims = new HashMap<>();
        claims.put("phone", phone);
        String regToken = signRegToken(phone, claims);
        Map<String, Object> ret = new HashMap<>();
        ret.put("regToken", regToken);
        return ret;
    }

    public Map<String, Object> registerStep2(RegisterStep2Req req) {
        Claims claims = parseRegToken(req.getRegToken());
        if (userService.handleExists(req.getHandle())) {
            throw new BusinessException(40002, "该用户名已被占用");
        }
        String email = req.getEmail() == null ? null : req.getEmail().trim().toLowerCase();
        if (email != null && !email.isEmpty() && userService.emailExists(email)) {
            throw new BusinessException(40003, "该邮箱已被占用");
        }
        Map<String, Object> next = copyClaims(claims);
        next.put("handle", req.getHandle());
        next.put("name", req.getName());
        next.put("email", email);
        next.put("passwordHash", passwordEncoder.encode(req.getPassword()));
        String regToken = signRegToken((String) claims.get("phone"), next);
        Map<String, Object> ret = new HashMap<>();
        ret.put("regToken", regToken);
        return ret;
    }

    public Map<String, Object> registerStep3(RegisterStep3Req req) {
        Claims claims = parseRegToken(req.getRegToken());
        if (claims.get("handle") == null) {
            throw new BusinessException(40020, "请先完成第 2 步");
        }
        Map<String, Object> next = copyClaims(claims);
        if (req.getAvatar() != null && !req.getAvatar().isBlank()) {
            next.put("avatar", req.getAvatar());
        }
        if (req.getBio() != null && !req.getBio().isBlank()) {
            next.put("bio", req.getBio());
        }
        if (req.getAvatarColor() != null && !req.getAvatarColor().isBlank()) {
            next.put("avatarColor", req.getAvatarColor());
        }
        String regToken = signRegToken((String) claims.get("phone"), next);
        Map<String, Object> ret = new HashMap<>();
        ret.put("regToken", regToken);
        return ret;
    }

    @Transactional
    public LoginRes registerStep4(RegisterStep4Req req) {
        Claims claims = parseRegToken(req.getRegToken());
        String phone = (String) claims.get("phone");
        String handle = (String) claims.get("handle");
        String name = (String) claims.get("name");
        String email = (String) claims.get("email");
        String passwordHash = (String) claims.get("passwordHash");
        String avatar = (String) claims.get("avatar");
        String bio = (String) claims.get("bio");
        String avatarColor = (String) claims.get("avatarColor");

        if (phone == null || handle == null || name == null || passwordHash == null) {
            throw new BusinessException(40020, "注册信息不完整，请回到第 2 步");
        }
        // 二次校验（用户在第 2 步之后可能有别人抢注）
        if (userService.handleExists(handle)) {
            throw new BusinessException(40002, "该用户名已被占用");
        }
        if (email != null && !email.isBlank() && userService.emailExists(email)) {
            throw new BusinessException(40003, "该邮箱已被占用");
        }
        if (userService.phoneExists(phone)) {
            throw new BusinessException(40020, "手机号已注册，请直接登录");
        }

        User u = new User();
        u.setHandle(handle);
        u.setName(name);
        u.setEmail(email);
        u.setPhone(phone);
        u.setAvatar(avatar);
        u.setBio(bio);
        u.setAvatarColor(avatarColor);
        u.setPasswordHash(passwordHash);
        u.setJoinedAt(LocalDateTime.now());
        userService.insert(u);

        // 可选：通过邀请码加入团队
        if (req.getInviteCode() != null && !req.getInviteCode().isBlank()) {
            joinTeamByInvite(u.getId(), req.getInviteCode().trim());
        }

        String token = jwtUtil.generate(u.getId(), u.getHandle());
        return LoginRes.builder()
                .token(token)
                .user(userService.buildMe(u.getId()))
                .build();
    }

    private void joinTeamByInvite(Long userId, String code) {
        inviteService.joinByCode(code, userId);
    }

    // ------------------------------------------------------------
    // regToken helpers
    // ------------------------------------------------------------

    private String signRegToken(String phone, Map<String, Object> claims) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject("register:" + phone)
                .issuer("skillstack")
                .issuedAt(new Date(now))
                .expiration(new Date(now + REG_TOKEN_TTL_SECONDS * 1000))
                .claims(claims)
                .signWith(regKey)
                .compact();
    }

    private Claims parseRegToken(String regToken) {
        try {
            Claims c = Jwts.parser().verifyWith(regKey).build()
                    .parseSignedClaims(regToken).getPayload();
            String sub = c.getSubject();
            if (sub == null || !sub.startsWith("register:")) {
                throw new BusinessException(40020, "非法的注册令牌");
            }
            return c;
        } catch (BusinessException be) {
            throw be;
        } catch (Exception e) {
            throw new BusinessException(40020, "注册令牌无效或已过期");
        }
    }

    private Map<String, Object> copyClaims(Claims claims) {
        Map<String, Object> m = new HashMap<>();
        for (Map.Entry<String, Object> e : claims.entrySet()) {
            // 跳过标准字段
            String k = e.getKey();
            if ("sub".equals(k) || "iss".equals(k) || "iat".equals(k) || "exp".equals(k) || "nbf".equals(k) || "jti".equals(k)) {
                continue;
            }
            m.put(k, e.getValue());
        }
        return m;
    }

    // ------------------------------------------------------------

    private String normalizePhone(String phone) {
        return phone == null ? "" : phone.replaceAll("\\D", "");
    }

    private boolean sendCodeByProvider(String phone, String code, String purpose) {
        if (smsProviderService == null || smsSenderDispatcher == null) {
            return false;
        }
        Optional<SmsProviderConfig> config = smsProviderService.getEnabledConfig();
        if (config.isEmpty()) {
            return false;
        }
        smsSenderDispatcher.send(config.get(), phone, code, purpose, SMS_TTL_SECONDS);
        return true;
    }

    private record SmsEntry(String code, long expireAt) {}
}
