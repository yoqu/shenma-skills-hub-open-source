package com.skillstack.admin.service;

import com.skillstack.admin.dto.AdminSuiteListItemVO;
import com.skillstack.admin.mapper.AdminSuiteMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.web.PageResult;
import com.skillstack.suite.entity.Suite;
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
public class AdminSuiteService {

    private final AdminSuiteMapper adminSuiteMapper;
    private final JdbcTemplate jdbc;

    public PageResult<AdminSuiteListItemVO> list(String q, Long teamId, long page, long size) {
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

        String countSql = "SELECT COUNT(*) FROM suites s " + where;
        Long total = jdbc.queryForObject(countSql, Long.class, args.toArray());
        long totalSafe = total == null ? 0L : total;

        if (totalSafe == 0) {
            return PageResult.of(Collections.emptyList(), 0, safePage, safeSize);
        }

        String listSql = """
                SELECT s.id, s.slug, s.name, s.team_id, s.visibility,
                       s.installs, s.skills_count, s.created_at,
                       t.name AS team_name
                FROM suites s
                LEFT JOIN teams t ON t.id = s.team_id
                """ + where + " ORDER BY s.id DESC LIMIT ? OFFSET ? ";

        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeSize);
        pageArgs.add(offset);

        List<AdminSuiteListItemVO> items = jdbc.query(listSql, (rs, i) -> AdminSuiteListItemVO.builder()
                .id(rs.getLong("id"))
                .slug(rs.getString("slug"))
                .name(rs.getString("name"))
                .teamId(rs.getLong("team_id"))
                .teamName(rs.getString("team_name"))
                .visibility(rs.getString("visibility"))
                .installs(rs.getInt("installs"))
                .skillsCount(rs.getInt("skills_count"))
                .createdAt(toLdt(rs.getTimestamp("created_at")))
                .build(), pageArgs.toArray());

        return PageResult.of(items, totalSafe, safePage, safeSize);
    }

    /**
     * 强制下架套件：visibility -> TEAM_PRIVATE。套件没有 status 字段。
     */
    @Transactional
    public Map<String, Object> unpublish(Long targetId) {
        Suite s = adminSuiteMapper.selectById(targetId);
        if (s == null) {
            throw new BusinessException(40400, "套件不存在");
        }
        String oldVis = s.getVisibility();
        s.setVisibility("TEAM_PRIVATE");
        adminSuiteMapper.updateById(s);

        Map<String, Object> p = new LinkedHashMap<>();
        p.put("suiteId", s.getId());
        p.put("slug", s.getSlug());
        p.put("teamId", s.getTeamId());
        p.put("oldVisibility", oldVis);
        p.put("newVisibility", "TEAM_PRIVATE");
        return p;
    }

    private static LocalDateTime toLdt(java.sql.Timestamp ts) {
        return ts == null ? null : ts.toLocalDateTime();
    }
}
