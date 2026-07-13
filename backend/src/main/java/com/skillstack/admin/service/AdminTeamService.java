package com.skillstack.admin.service;

import com.skillstack.admin.dto.AdminTeamDetailVO;
import com.skillstack.admin.dto.AdminTeamListItemVO;
import com.skillstack.admin.mapper.AdminTeamMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.storage.StorageUrlResolver;
import com.skillstack.common.web.PageResult;
import com.skillstack.team.entity.Team;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminTeamService {

    private final AdminTeamMapper adminTeamMapper;
    private final JdbcTemplate jdbc;
    private final StorageUrlResolver storageUrlResolver;

    /* ---------------- 查询 ---------------- */

    public PageResult<AdminTeamListItemVO> list(String q, String status, long page, long size) {
        long safeSize = Math.min(Math.max(size, 1), 100);
        long safePage = Math.max(page, 1);
        long offset = (safePage - 1) * safeSize;

        StringBuilder where = new StringBuilder(" WHERE t.deleted = 0 ");
        List<Object> args = new ArrayList<>();
        if (q != null && !q.isBlank()) {
            where.append(" AND (t.slug LIKE ? OR t.name LIKE ?) ");
            String like = "%" + q.trim() + "%";
            args.add(like);
            args.add(like);
        }
        if (status != null && !status.isBlank()) {
            where.append(" AND t.status = ? ");
            args.add(status.trim());
        }

        String countSql = "SELECT COUNT(*) FROM teams t " + where;
        Long total = jdbc.queryForObject(countSql, Long.class, args.toArray());
        long totalSafe = total == null ? 0L : total;

        if (totalSafe == 0) {
            return PageResult.of(Collections.emptyList(), 0, safePage, safeSize);
        }

        // owner 用 LEFT JOIN：取角色为 OWNER 的第一条 team_member -> users
        String listSql = """
                SELECT t.id, t.slug, t.name, t.status, t.created_at,
                       t.members_count, t.public_skills, t.private_skills, t.suites_count,
                       (SELECT u.handle FROM team_members tm
                          JOIN users u ON u.id = tm.user_id AND u.deleted = 0
                          WHERE tm.team_id = t.id AND tm.role = 'OWNER' AND tm.deleted = 0
                          ORDER BY tm.joined_at ASC LIMIT 1) AS owner_handle,
                       (SELECT u.name FROM team_members tm
                          JOIN users u ON u.id = tm.user_id AND u.deleted = 0
                          WHERE tm.team_id = t.id AND tm.role = 'OWNER' AND tm.deleted = 0
                          ORDER BY tm.joined_at ASC LIMIT 1) AS owner_name
                FROM teams t
                """ + where + " ORDER BY t.id DESC LIMIT ? OFFSET ? ";

        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeSize);
        pageArgs.add(offset);

        List<AdminTeamListItemVO> items = jdbc.query(listSql, (rs, i) -> AdminTeamListItemVO.builder()
                .id(rs.getLong("id"))
                .slug(rs.getString("slug"))
                .name(rs.getString("name"))
                .ownerHandle(rs.getString("owner_handle"))
                .ownerName(rs.getString("owner_name"))
                .membersCount(rs.getInt("members_count"))
                .skillsCount(rs.getInt("public_skills") + rs.getInt("private_skills"))
                .suitesCount(rs.getInt("suites_count"))
                .status(rs.getString("status"))
                .createdAt(toLdt(rs.getTimestamp("created_at")))
                .build(), pageArgs.toArray());

        return PageResult.of(items, totalSafe, safePage, safeSize);
    }

    public AdminTeamDetailVO detail(Long id) {
        Team t = adminTeamMapper.selectById(id);
        if (t == null) {
            throw new BusinessException(40400, "团队不存在");
        }

        Map<String, Object> owner = jdbc.query("""
                SELECT u.handle, u.name FROM team_members tm
                JOIN users u ON u.id = tm.user_id AND u.deleted = 0
                WHERE tm.team_id = ? AND tm.role = 'OWNER' AND tm.deleted = 0
                ORDER BY tm.joined_at ASC LIMIT 1
                """, rs -> rs.next()
                        ? Map.of("handle", rs.getString("handle"), "name", rs.getString("name"))
                        : Collections.<String, Object>emptyMap(),
                id);

        int publicSkills = t.getPublicSkills() == null ? 0 : t.getPublicSkills();
        int privateSkills = t.getPrivateSkills() == null ? 0 : t.getPrivateSkills();

        return AdminTeamDetailVO.builder()
                .id(t.getId())
                .slug(t.getSlug())
                .name(t.getName())
                .ownerHandle(owner == null ? null : (String) owner.get("handle"))
                .ownerName(owner == null ? null : (String) owner.get("name"))
                .membersCount(t.getMembersCount())
                .skillsCount(publicSkills + privateSkills)
                .suitesCount(t.getSuitesCount())
                .status(t.getStatus() == null ? "ACTIVE" : t.getStatus())
                .createdAt(t.getCreatedAt())
                .description(t.getDescription())
                .logoUrl(storageUrlResolver.resolveSingle(t.getLogoUrl()))
                .color(t.getColor())
                .reviewMode(t.getReviewMode())
                .publicHome(t.getPublicHome())
                .build();
    }

    /* ---------------- 写操作 ---------------- */

    @Transactional
    public Map<String, Object> disable(Long targetId) {
        Team t = mustGet(targetId);
        String old = t.getStatus();
        if ("DISABLED".equals(old)) {
            return payload(t, "DISABLED", "DISABLED");
        }
        t.setStatus("DISABLED");
        adminTeamMapper.updateById(t);
        return payload(t, old, "DISABLED");
    }

    @Transactional
    public Map<String, Object> enable(Long targetId) {
        Team t = mustGet(targetId);
        String old = t.getStatus();
        if ("ACTIVE".equals(old) || old == null) {
            t.setStatus("ACTIVE");
            adminTeamMapper.updateById(t);
            return payload(t, old, "ACTIVE");
        }
        t.setStatus("ACTIVE");
        adminTeamMapper.updateById(t);
        return payload(t, old, "ACTIVE");
    }

    /* ---------------- 内部 ---------------- */

    private Team mustGet(Long id) {
        Team t = adminTeamMapper.selectById(id);
        if (t == null) {
            throw new BusinessException(40400, "团队不存在");
        }
        return t;
    }

    private Map<String, Object> payload(Team t, Object oldStatus, Object newStatus) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("teamId", t.getId());
        p.put("slug", t.getSlug());
        p.put("field", "status");
        p.put("old", oldStatus);
        p.put("new", newStatus);
        return p;
    }

    private static LocalDateTime toLdt(java.sql.Timestamp ts) {
        return ts == null ? null : ts.toLocalDateTime();
    }

    /**
     * 平台超管改团队基础字段。name 与 slug 都可为 null（表示不变），都不为 null 时同事务提交。
     * slug 唯一性在事务内 SELECT 之后再 UPDATE，避免竞态。
     * 返回旧值 map 供审计使用。
     */
    @Transactional
    public Map<String, Object> updateBasic(Long id, String name, String slug) {
        Team t = mustGet(id);
        Map<String, Object> changes = new LinkedHashMap<>();
        if (name != null) {
            String trimmed = name.trim();
            if (trimmed.isEmpty() || trimmed.length() > 60) {
                throw new BusinessException(40001, "name 长度需在 1-60 之间");
            }
            if (!trimmed.equals(t.getName())) {
                changes.put("name", Map.of("old", t.getName(), "new", trimmed));
                t.setName(trimmed);
            }
        }
        if (slug != null) {
            String s = slug.trim();
            if (!s.matches("[a-z0-9-]{2,40}")) {
                throw new BusinessException(40001, "slug 格式不合法");
            }
            if (!s.equals(t.getSlug())) {
                Long dup = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM teams WHERE slug = ? AND id <> ? AND deleted = 0",
                        Long.class, s, id);
                if (dup != null && dup > 0) {
                    throw new BusinessException(40901, "slug 已被其他团队占用");
                }
                changes.put("slug", Map.of("old", t.getSlug(), "new", s));
                t.setSlug(s);
            }
        }
        if (!changes.isEmpty()) {
            adminTeamMapper.updateById(t);
        }
        changes.put("teamId", t.getId());
        return changes;
    }
}
