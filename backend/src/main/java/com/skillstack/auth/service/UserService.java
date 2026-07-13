package com.skillstack.auth.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.skillstack.auth.dto.ChangePasswordReq;
import com.skillstack.auth.dto.ChangePhoneReq;
import com.skillstack.auth.dto.MeRes;
import com.skillstack.auth.dto.UpdateMeProfileReq;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.storage.StorageUrlResolver;
import com.skillstack.common.storage.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 用户领域服务：账号 CRUD + MeRes 组装（跨表只读）。
 *
 * MeRes 中的 my_teams 通过 join team_members + teams + user_team_unread 拼装。
 * BE-Team 的 entity / mapper 还没建，这里临时用 JdbcTemplate 跑只读 SQL，
 * 后续可以替换为对应 mapper（无侵入式重构）。
 */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserMapper userMapper;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final StorageService storageService;
    private final StorageUrlResolver storageUrlResolver;

    @FunctionalInterface
    public interface SmsVerifier {
        void verify(String phone, String smsCode);
    }

    public User getById(Long id) {
        User u = userMapper.selectById(id);
        if (u == null) {
            throw new BusinessException(40400, "用户不存在");
        }
        return u;
    }

    public User findByHandle(String handle) {
        return userMapper.selectOne(Wrappers.<User>lambdaQuery().eq(User::getHandle, handle));
    }

    public User findByEmail(String email) {
        return userMapper.selectOne(Wrappers.<User>lambdaQuery().eq(User::getEmail, email));
    }

    public User findByPhone(String phone) {
        return userMapper.selectOne(Wrappers.<User>lambdaQuery().eq(User::getPhone, phone));
    }

    public User findByFeishuOpenIdAndTenantKey(String openId, String tenantKey) {
        if (openId == null || openId.isBlank() || tenantKey == null || tenantKey.isBlank()) {
            return null;
        }
        return userMapper.selectOne(Wrappers.<User>lambdaQuery()
                .eq(User::getFeishuOpenId, openId)
                .eq(User::getFeishuTenantKey, tenantKey));
    }

    /**
     * 多字段匹配登录标识：依次尝试 handle / email / phone。
     */
    public User findByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return null;
        }
        User u = findByHandle(identifier);
        if (u != null) return u;
        u = findByEmail(identifier);
        if (u != null) return u;
        return findByPhone(identifier);
    }

    public boolean handleExists(String handle) {
        return userMapper.selectCount(Wrappers.<User>lambdaQuery().eq(User::getHandle, handle)) > 0;
    }

    public boolean emailExists(String email) {
        return userMapper.selectCount(Wrappers.<User>lambdaQuery().eq(User::getEmail, email)) > 0;
    }

    public boolean phoneExists(String phone) {
        return userMapper.selectCount(Wrappers.<User>lambdaQuery().eq(User::getPhone, phone)) > 0;
    }

    public Long insert(User u) {
        userMapper.insert(u);
        return u.getId();
    }

    public User upsertByFeishuUser(FeishuAuthService.FeishuUserInfo info) {
        User u = findByFeishuOpenIdAndTenantKey(info.getOpenId(), info.getTenantKey());
        if (u == null) {
            u = new User();
            u.setHandle(nextFeishuHandle(info.getOpenId()));
            u.setJoinedAt(LocalDateTime.now());
            u.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        }

        Long userId = u.getId();
        u.setFeishuOpenId(info.getOpenId());
        u.setFeishuUnionId(blankToNull(info.getUnionId()));
        u.setFeishuTenantKey(info.getTenantKey());
        u.setName(nonBlank(info.getName(), "飞书用户"));
        u.setEmail(uniqueEmailForUser(userId, info.getEmail()));
        u.setPhone(uniquePhoneForUser(userId, normalizePhone(info.getMobile())));
        u.setFeishuAvatarUrl(blankToNull(info.getAvatarUrl()));
        u.setLastLogin(LocalDateTime.now());

        if (u.getId() == null) {
            userMapper.insert(u);
        } else {
            userMapper.updateById(u);
        }
        return u;
    }

    public MeRes updateProfile(Long userId, UpdateMeProfileReq req) {
        User u = getById(userId);
        String email = normalizeEmail(req.getEmail());
        if (email != null) {
            User emailOwner = findByEmail(email);
            if (emailOwner != null && !userId.equals(emailOwner.getId())) {
                throw new BusinessException(40003, "该邮箱已被占用");
            }
        }

        u.setName(req.getName().trim());
        u.setEmail(email);
        u.setAvatar(blankToNull(req.getAvatar()));
        userMapper.updateById(u);
        return buildMe(userId);
    }

    public void changePassword(Long userId, ChangePasswordReq req) {
        User u = getById(userId);
        requirePassword(u, req.getCurrentPassword());
        u.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        userMapper.updateById(u);
    }

    public MeRes changePhone(Long userId, ChangePhoneReq req, SmsVerifier smsVerifier) {
        User u = getById(userId);
        requirePassword(u, req.getCurrentPassword());
        String phone = normalizePhone(req.getPhone());
        smsVerifier.verify(phone, req.getSmsCode());

        User phoneOwner = findByPhone(phone);
        if (phoneOwner != null && !userId.equals(phoneOwner.getId())) {
            throw new BusinessException(40020, "手机号已被占用");
        }

        u.setPhone(phone);
        userMapper.updateById(u);
        return buildMe(userId);
    }

    /**
     * 组装 MeRes：基础信息 + my_teams 列表（含角色 / 成员数 / 未读数）。
     */
    public MeRes buildMe(Long userId) {
        User u = getById(userId);

        List<MeRes.MyTeam> myTeams = jdbc.query("""
                SELECT t.id, t.slug, t.name, t.avatar_char, t.color, t.members_count,
                       tm.role,
                       COALESCE(utu.unread, 0) AS unread
                FROM team_members tm
                JOIN teams t ON t.id = tm.team_id AND t.deleted = 0
                LEFT JOIN user_team_unread utu
                       ON utu.user_id = tm.user_id AND utu.team_id = tm.team_id AND utu.deleted = 0
                WHERE tm.user_id = ? AND tm.deleted = 0
                ORDER BY tm.joined_at ASC
                """,
                (rs, i) -> MeRes.MyTeam.builder()
                        .id(rs.getLong("id"))
                        .slug(rs.getString("slug"))
                        .name(rs.getString("name"))
                        .avatar(rs.getString("avatar_char"))
                        .color(rs.getString("color"))
                        .role(rs.getString("role"))
                        .members(rs.getInt("members_count"))
                        .unread(rs.getInt("unread"))
                        .build(),
                userId);

        String primaryRole = myTeams.isEmpty() ? null : myTeams.get(0).getRole();
        Long joinedDays = null;
        if (u.getJoinedAt() != null) {
            joinedDays = ChronoUnit.DAYS.between(u.getJoinedAt(), LocalDateTime.now());
        }

        return MeRes.builder()
                .id(u.getId())
                .handle(u.getHandle())
                .name(u.getName())
                .email(u.getEmail())
                .phone(u.getPhone())
                .avatar(u.getAvatar())
                .avatarUrl(resolveAvatarUrl(u))
                .avatarColor(u.getAvatarColor())
                .bio(u.getBio())
                .role(primaryRole)
                .platformRole(u.getPlatformRole() == null ? "USER" : u.getPlatformRole())
                .status(u.getStatus() == null ? "ACTIVE" : u.getStatus())
                .joinedDays(joinedDays)
                .myTeams(myTeams != null ? myTeams : new ArrayList<>())
                .build();
    }

    public Map<String, Object> buildPublicProfile(String handle) {
        List<Map<String, Object>> users = jdbc.queryForList("""
                SELECT u.id, u.handle, u.name, u.avatar, u.avatar_url, u.feishu_avatar_url, u.joined_at,
                       tm.role, t.slug AS team_slug, t.name AS team_name
                FROM users u
                LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.deleted = 0
                LEFT JOIN teams t ON t.id = tm.team_id AND t.deleted = 0
                WHERE u.handle = ? AND u.deleted = 0
                ORDER BY tm.joined_at ASC
                LIMIT 1
                """, handle);
        if (users.isEmpty()) {
            throw new BusinessException(40400, "用户不存在");
        }

        Map<String, Object> row = users.get(0);
        Long userId = ((Number) row.get("id")).longValue();
        List<Map<String, Object>> skills = jdbc.queryForList("""
                SELECT s.id, s.slug, s.name, s.short_desc, s.cat_code, s.icon, s.installs,
                       s.stars, s.score, s.version, s.visibility, s.status, s.safety,
                       s.eval_score, s.langs,
                       DATE_FORMAT(COALESCE(s.published_at, s.updated_at), '%Y-%m-%d') AS updated,
                       u.name AS author_name, u.handle AS author_handle,
                       t.slug AS team_slug
                FROM skills s
                JOIN users u ON u.id = s.author_id AND u.deleted = 0
                JOIN teams t ON t.id = s.team_id AND t.deleted = 0
                WHERE s.author_id = ?
                  AND s.visibility = 'PUBLIC'
                  AND s.status = 'APPROVED'
                  AND s.deleted = 0
                ORDER BY s.published_at DESC, s.updated_at DESC
                """, userId);

        List<Map<String, Object>> normalizedSkills = new ArrayList<>();
        int totalInstalls = 0;
        for (Map<String, Object> s : skills) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", s.get("id"));
            item.put("slug", s.get("slug"));
            item.put("name", s.get("name"));
            item.put("shortDesc", s.get("short_desc"));
            item.put("cat", s.get("cat_code"));
            item.put("icon", s.get("icon"));
            item.put("installs", s.get("installs"));
            item.put("stars", s.get("stars"));
            item.put("score", s.get("score"));
            item.put("version", s.get("version"));
            item.put("updated", s.get("updated"));
            item.put("visibility", s.get("visibility"));
            item.put("status", s.get("status"));
            item.put("team", s.get("team_slug"));
            item.put("safety", s.get("safety"));
            item.put("evalScore", s.get("eval_score"));
            item.put("tags", List.of());
            item.put("langs", List.of());
            item.put("author", Map.of(
                    "name", s.get("author_name"),
                    "handle", s.get("author_handle")
            ));
            normalizedSkills.add(item);
            if (s.get("installs") instanceof Number n) {
                totalInstalls += n.intValue();
            }
        }

        Map<String, Object> profile = new HashMap<>();
        profile.put("id", userId);
        profile.put("handle", row.get("handle"));
        profile.put("name", row.get("name"));
        profile.put("avatar", row.get("avatar"));
        profile.put("avatarUrl", storageUrlResolver.resolve(
                (String) row.get("avatar_url"),
                (String) row.get("feishu_avatar_url")));
        profile.put("joined", row.get("joined_at"));
        profile.put("role", row.get("role"));
        Map<String, Object> team = new HashMap<>();
        team.put("slug", row.get("team_slug"));
        team.put("name", row.get("team_name"));
        profile.put("team", team);
        profile.put("skills", normalizedSkills);
        profile.put("skillsCount", normalizedSkills.size());
        profile.put("installs", totalInstalls);
        profile.put("followers", 0);
        profile.put("following", 0);
        return profile;
    }

    public String uploadAvatar(Long userId, MultipartFile file) {
        // 校验文件非空
        if (file == null || file.isEmpty()) {
            throw new BusinessException(40001, "请选择要上传的图片");
        }
        // 校验类型
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new BusinessException(40002, "仅支持 JPG / PNG / GIF / WebP");
        }
        // 校验大小 2MB
        if (file.getSize() > 2L * 1024 * 1024) {
            throw new BusinessException(40003, "图片大小不能超过 2MB");
        }
        User user = userMapper.selectById(userId);
        // 删除旧文件
        if (user.getAvatarUrl() != null) {
            storageService.delete(user.getAvatarUrl());
        }
        // 存储新文件
        String key;
        try {
            key = storageService.store(file, "avatars/" + userId);
        } catch (IOException e) {
            throw new BusinessException(50001, "头像上传失败，请重试");
        }
        // 更新数据库
        User update = new User();
        update.setId(userId);
        update.setAvatarUrl(key);
        userMapper.updateById(update);
        return storageService.resolveUrl(key);
    }

    private void requirePassword(User u, String rawPassword) {
        if (rawPassword == null || !passwordEncoder.matches(rawPassword, u.getPasswordHash())) {
            throw new BusinessException(40001, "当前密码错误");
        }
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        return email.trim().toLowerCase();
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String resolveAvatarUrl(User u) {
        return storageUrlResolver.resolve(u.getAvatarUrl(), u.getFeishuAvatarUrl());
    }

    private String uniqueEmailForUser(Long userId, String email) {
        String normalized = normalizeEmail(email);
        if (normalized == null) {
            return null;
        }
        User owner = findByEmail(normalized);
        if (owner == null || owner.getId().equals(userId)) {
            return normalized;
        }
        return null;
    }

    private String uniquePhoneForUser(Long userId, String phone) {
        if (phone == null || phone.isBlank()) {
            return null;
        }
        User owner = findByPhone(phone);
        if (owner == null || owner.getId().equals(userId)) {
            return phone;
        }
        return null;
    }

    private String nextFeishuHandle(String openId) {
        String base = ("fs_" + nonBlank(openId, UUID.randomUUID().toString()))
                .replaceAll("[^A-Za-z0-9_]", "_");
        if (base.length() > 48) {
            base = base.substring(0, 48);
        }
        String candidate = base;
        int i = 1;
        while (handleExists(candidate)) {
            candidate = base + "_" + i++;
        }
        return candidate;
    }

    private String nonBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String normalizePhone(String phone) {
        return phone == null ? "" : phone.replaceAll("\\D", "");
    }
}
