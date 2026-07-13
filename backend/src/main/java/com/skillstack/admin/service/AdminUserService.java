package com.skillstack.admin.service;

import com.skillstack.admin.dto.AdminUserDetailVO;
import com.skillstack.admin.dto.AdminUserListItemVO;
import com.skillstack.admin.mapper.AdminUserMapper;
import com.skillstack.auth.entity.User;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.storage.StorageUrlResolver;
import com.skillstack.common.web.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminUserService {

    private static final String ALPHABET =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private static final SecureRandom RNG = new SecureRandom();

    private final AdminUserMapper adminUserMapper;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final StorageUrlResolver storageUrlResolver;

    /* ---------------- 查询 ---------------- */

    public PageResult<AdminUserListItemVO> list(String q, String platformRole, String status,
                                                long page, long size) {
        long safeSize = Math.min(Math.max(size, 1), 100);
        long safePage = Math.max(page, 1);
        long offset = (safePage - 1) * safeSize;

        StringBuilder where = new StringBuilder(" WHERE u.deleted = 0 ");
        List<Object> args = new ArrayList<>();
        if (q != null && !q.isBlank()) {
            where.append(" AND (u.handle LIKE ? OR u.name LIKE ? OR u.email LIKE ?) ");
            String like = "%" + q.trim() + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }
        if (platformRole != null && !platformRole.isBlank()) {
            where.append(" AND u.platform_role = ? ");
            args.add(platformRole.trim());
        }
        if (status != null && !status.isBlank()) {
            where.append(" AND u.status = ? ");
            args.add(status.trim());
        }

        String countSql = "SELECT COUNT(*) FROM users u " + where;
        Long total = jdbc.queryForObject(countSql, Long.class, args.toArray());
        long totalSafe = total == null ? 0L : total;

        if (totalSafe == 0) {
            return PageResult.of(Collections.emptyList(), 0, safePage, safeSize);
        }

        String listSql = """
                SELECT u.id, u.handle, u.name, u.email, u.phone,
                       COALESCE(u.avatar_url, u.feishu_avatar_url) AS avatar_url,
                       u.platform_role, u.status, u.joined_at, u.last_login,
                       (SELECT COUNT(*) FROM team_members tm
                          JOIN teams t ON t.id = tm.team_id AND t.deleted = 0
                          WHERE tm.user_id = u.id AND tm.deleted = 0) AS teams_count
                FROM users u
                """ + where + " ORDER BY u.id DESC LIMIT ? OFFSET ? ";

        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeSize);
        pageArgs.add(offset);

        List<AdminUserListItemVO> items = jdbc.query(listSql, (rs, i) -> AdminUserListItemVO.builder()
                .id(rs.getLong("id"))
                .handle(rs.getString("handle"))
                .name(rs.getString("name"))
                .email(rs.getString("email"))
                .phone(rs.getString("phone"))
                .avatarUrl(storageUrlResolver.resolveSingle(rs.getString("avatar_url")))
                .platformRole(rs.getString("platform_role"))
                .status(rs.getString("status"))
                .teamsCount(rs.getInt("teams_count"))
                .joinedAt(toLdt(rs.getTimestamp("joined_at")))
                .lastLogin(toLdt(rs.getTimestamp("last_login")))
                .build(), pageArgs.toArray());

        return PageResult.of(items, totalSafe, safePage, safeSize);
    }

    public AdminUserDetailVO detail(Long id) {
        User u = adminUserMapper.selectById(id);
        if (u == null) {
            throw new BusinessException(40400, "用户不存在");
        }

        List<AdminUserDetailVO.TeamRef> teams = jdbc.query("""
                SELECT t.id, t.slug, t.name, tm.role
                FROM team_members tm
                JOIN teams t ON t.id = tm.team_id AND t.deleted = 0
                WHERE tm.user_id = ? AND tm.deleted = 0
                ORDER BY tm.joined_at ASC
                """,
                (rs, i) -> AdminUserDetailVO.TeamRef.builder()
                        .id(rs.getLong("id"))
                        .slug(rs.getString("slug"))
                        .name(rs.getString("name"))
                        .role(rs.getString("role"))
                        .build(),
                id);

        return AdminUserDetailVO.builder()
                .id(u.getId())
                .handle(u.getHandle())
                .name(u.getName())
                .email(u.getEmail())
                .phone(u.getPhone())
                .avatarUrl(storageUrlResolver.resolve(u.getAvatarUrl(), u.getFeishuAvatarUrl()))
                .platformRole(u.getPlatformRole() == null ? "USER" : u.getPlatformRole())
                .status(u.getStatus() == null ? "ACTIVE" : u.getStatus())
                .teamsCount(teams.size())
                .joinedAt(u.getJoinedAt())
                .lastLogin(u.getLastLogin())
                .bio(u.getBio())
                .teams(teams)
                .build();
    }

    /* ---------------- 写操作 ---------------- */

    @Transactional
    public Map<String, Object> disable(Long actorId, Long targetId) {
        if (actorId != null && actorId.equals(targetId)) {
            throw new BusinessException(40300, "不能对自己执行该操作");
        }
        User u = mustGet(targetId);
        if ("DISABLED".equals(u.getStatus())) {
            return payload(u, "status", "DISABLED", "DISABLED");
        }
        if ("SUPER_ADMIN".equals(u.getPlatformRole()) && isLastActiveSuperAdmin(targetId)) {
            throw new BusinessException(40901, "至少需要保留一个超级管理员");
        }
        String old = u.getStatus();
        u.setStatus("DISABLED");
        adminUserMapper.updateById(u);
        return payload(u, "status", old, "DISABLED");
    }

    @Transactional
    public Map<String, Object> enable(Long targetId) {
        User u = mustGet(targetId);
        if ("ACTIVE".equals(u.getStatus())) {
            return payload(u, "status", "ACTIVE", "ACTIVE");
        }
        String old = u.getStatus();
        u.setStatus("ACTIVE");
        adminUserMapper.updateById(u);
        return payload(u, "status", old, "ACTIVE");
    }

    @Transactional
    public Map<String, Object> promote(Long targetId) {
        User u = mustGet(targetId);
        if ("SUPER_ADMIN".equals(u.getPlatformRole())) {
            return payload(u, "platformRole", "SUPER_ADMIN", "SUPER_ADMIN");
        }
        String old = u.getPlatformRole();
        u.setPlatformRole("SUPER_ADMIN");
        adminUserMapper.updateById(u);
        return payload(u, "platformRole", old, "SUPER_ADMIN");
    }

    @Transactional
    public Map<String, Object> demote(Long actorId, Long targetId) {
        if (actorId != null && actorId.equals(targetId)) {
            throw new BusinessException(40300, "不能对自己执行该操作");
        }
        User u = mustGet(targetId);
        if (!"SUPER_ADMIN".equals(u.getPlatformRole())) {
            return payload(u, "platformRole", u.getPlatformRole(), "USER");
        }
        if (isLastActiveSuperAdmin(targetId)) {
            throw new BusinessException(40901, "至少需要保留一个超级管理员");
        }
        String old = u.getPlatformRole();
        u.setPlatformRole("USER");
        adminUserMapper.updateById(u);
        return payload(u, "platformRole", old, "USER");
    }

    @Transactional
    public ResetPasswordResult resetPassword(Long targetId) {
        User u = mustGet(targetId);
        String plain = randomTempPassword(12);
        u.setPasswordHash(passwordEncoder.encode(plain));
        adminUserMapper.updateById(u);
        return new ResetPasswordResult(u.getId(), u.getHandle(), plain);
    }

    /* ---------------- 内部 ---------------- */

    private User mustGet(Long id) {
        User u = adminUserMapper.selectById(id);
        if (u == null) {
            throw new BusinessException(40400, "用户不存在");
        }
        return u;
    }

    /** 只有一个 ACTIVE 且 SUPER_ADMIN 的账号 = target 本人时返回 true。 */
    private boolean isLastActiveSuperAdmin(Long targetId) {
        Long others = jdbc.queryForObject("""
                SELECT COUNT(*) FROM users
                 WHERE platform_role = 'SUPER_ADMIN'
                   AND status = 'ACTIVE'
                   AND deleted = 0
                   AND id <> ?
                """, Long.class, targetId);
        return others == null || others == 0L;
    }

    private Map<String, Object> payload(User u, String field, Object oldVal, Object newVal) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("userId", u.getId());
        p.put("handle", u.getHandle());
        p.put("field", field);
        p.put("old", oldVal);
        p.put("new", newVal);
        return p;
    }

    private static String randomTempPassword(int len) {
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            sb.append(ALPHABET.charAt(RNG.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    private static LocalDateTime toLdt(java.sql.Timestamp ts) {
        return ts == null ? null : ts.toLocalDateTime();
    }

    public record ResetPasswordResult(Long userId, String handle, String tempPassword) {}
}
