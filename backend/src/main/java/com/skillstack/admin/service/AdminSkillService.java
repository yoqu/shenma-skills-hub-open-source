package com.skillstack.admin.service;

import com.skillstack.admin.dto.AdminSkillListItemVO;
import com.skillstack.admin.mapper.AdminSkillMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.web.PageResult;
import com.skillstack.skill.entity.Skill;
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
public class AdminSkillService {

    private final AdminSkillMapper adminSkillMapper;
    private final JdbcTemplate jdbc;

    public PageResult<AdminSkillListItemVO> list(String q, Long teamId, String status, String visibility,
                                                 long page, long size) {
        long safeSize = Math.min(Math.max(size, 1), 100);
        long safePage = Math.max(page, 1);
        long offset = (safePage - 1) * safeSize;

        StringBuilder where = new StringBuilder(" WHERE s.deleted = 0 ");
        List<Object> args = new ArrayList<>();
        if (q != null && !q.isBlank()) {
            where.append(" AND (s.slug LIKE ? OR s.name LIKE ?) ");
            String like = "%" + q.trim() + "%";
            args.add(like);
            args.add(like);
        }
        if (teamId != null) {
            where.append(" AND s.team_id = ? ");
            args.add(teamId);
        }
        if (status != null && !status.isBlank()) {
            where.append(" AND s.status = ? ");
            args.add(status.trim());
        }
        if (visibility != null && !visibility.isBlank()) {
            where.append(" AND s.visibility = ? ");
            args.add(visibility.trim());
        }

        String countSql = "SELECT COUNT(*) FROM skills s " + where;
        Long total = jdbc.queryForObject(countSql, Long.class, args.toArray());
        long totalSafe = total == null ? 0L : total;

        if (totalSafe == 0) {
            return PageResult.of(Collections.emptyList(), 0, safePage, safeSize);
        }

        String listSql = """
                SELECT s.id, s.slug, s.name, s.team_id, s.author_id,
                       s.status, s.visibility, s.installs, s.stars, s.published_at,
                       t.name AS team_name,
                       u.handle AS author_handle
                FROM skills s
                LEFT JOIN teams t ON t.id = s.team_id
                LEFT JOIN users u ON u.id = s.author_id
                """ + where + " ORDER BY s.id DESC LIMIT ? OFFSET ? ";

        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeSize);
        pageArgs.add(offset);

        List<AdminSkillListItemVO> items = jdbc.query(listSql, (rs, i) -> AdminSkillListItemVO.builder()
                .id(rs.getLong("id"))
                .slug(rs.getString("slug"))
                .name(rs.getString("name"))
                .teamId(rs.getLong("team_id"))
                .teamName(rs.getString("team_name"))
                .authorId(rs.getLong("author_id"))
                .authorHandle(rs.getString("author_handle"))
                .status(rs.getString("status"))
                .visibility(rs.getString("visibility"))
                .installs(rs.getInt("installs"))
                .stars(rs.getInt("stars"))
                .publishedAt(toLdt(rs.getTimestamp("published_at")))
                .build(), pageArgs.toArray());

        return PageResult.of(items, totalSafe, safePage, safeSize);
    }

    /**
     * 强制下架：status -> ARCHIVED, visibility -> TEAM_PRIVATE。
     *
     * <p>注意：现有 {@link Skill#getStatus()} 列举的枚举不包含 "ARCHIVED"，但此处直接写入字符串，
     * 由迁移 / 业务约定承载。ARCHIVED 是 admin 专属态，团队浏览查询应将其与 PUBLIC/APPROVED 一并排除。</p>
     *
     * <p>TODO: 后续应在 SkillService 团队读写路径中显式过滤 ARCHIVED 状态；本期不修改既有 service。</p>
     */
    @Transactional
    public Map<String, Object> unpublish(Long targetId) {
        Skill s = adminSkillMapper.selectById(targetId);
        if (s == null) {
            throw new BusinessException(40400, "Skill 不存在");
        }
        String oldStatus = s.getStatus();
        String oldVis = s.getVisibility();
        s.setStatus("ARCHIVED");
        s.setVisibility("TEAM_PRIVATE");
        adminSkillMapper.updateById(s);

        Map<String, Object> p = new LinkedHashMap<>();
        p.put("skillId", s.getId());
        p.put("slug", s.getSlug());
        p.put("teamId", s.getTeamId());
        p.put("oldStatus", oldStatus);
        p.put("newStatus", "ARCHIVED");
        p.put("oldVisibility", oldVis);
        p.put("newVisibility", "TEAM_PRIVATE");
        return p;
    }

    private static LocalDateTime toLdt(java.sql.Timestamp ts) {
        return ts == null ? null : ts.toLocalDateTime();
    }
}
