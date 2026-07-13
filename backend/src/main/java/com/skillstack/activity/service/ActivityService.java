package com.skillstack.activity.service;

import com.skillstack.activity.dto.ActivityItem;
import com.skillstack.common.storage.StorageUrlResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ActivityService {

    private final JdbcTemplate jdbc;
    private final StorageUrlResolver storageUrlResolver;

    /**
     * 团队活动流(按 created_at 倒序,取最近 limit 条)。
     * 一次 join 把 actor 头像/名字、target skill/suite slug 都带出来。
     */
    public List<ActivityItem> listByTeam(Long teamId, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 200);
        String sql = "SELECT a.id, a.kind, a.target, a.extra, a.when_label, a.created_at, " +
                "       a.actor_id, u.name AS actor_name, u.handle AS actor_handle, " +
                "       u.avatar AS actor_avatar, " +
                "       COALESCE(u.avatar_url, u.feishu_avatar_url) AS actor_avatar_url, " +
                "       a.target_skill_id, sk.slug AS skill_slug, " +
                "       a.target_suite_id, su.slug AS suite_slug " +
                "FROM activity a " +
                "JOIN users u  ON u.id  = a.actor_id        AND u.deleted  = 0 " +
                "LEFT JOIN skills sk ON sk.id = a.target_skill_id AND sk.deleted = 0 " +
                "LEFT JOIN suites su ON su.id = a.target_suite_id AND su.deleted = 0 " +
                "WHERE a.team_id = ? AND a.deleted = 0 " +
                "ORDER BY a.created_at DESC, a.id DESC " +
                "LIMIT ?";
        return jdbc.query(sql, (rs, i) -> {
            ActivityItem it = new ActivityItem();
            it.setId(rs.getLong("id"));
            it.setKind(rs.getString("kind"));
            it.setActorId(rs.getLong("actor_id"));
            it.setActor(rs.getString("actor_name"));
            it.setActorHandle(rs.getString("actor_handle"));
            it.setActorAvatar(rs.getString("actor_avatar"));
            it.setActorAvatarUrl(storageUrlResolver.resolveSingle(rs.getString("actor_avatar_url")));
            it.setTarget(rs.getString("target"));
            long skillId = rs.getLong("target_skill_id");
            it.setTargetSkillId(rs.wasNull() ? null : skillId);
            it.setTargetSkillSlug(rs.getString("skill_slug"));
            long suiteId = rs.getLong("target_suite_id");
            it.setTargetSuiteId(rs.wasNull() ? null : suiteId);
            it.setTargetSuiteSlug(rs.getString("suite_slug"));
            it.setExtra(rs.getString("extra"));
            it.setTimeAgo(rs.getString("when_label"));
            Timestamp ts = rs.getTimestamp("created_at");
            it.setCreatedAt(ts == null ? null : ts.toLocalDateTime());
            return it;
        }, teamId, safeLimit);
    }
}
