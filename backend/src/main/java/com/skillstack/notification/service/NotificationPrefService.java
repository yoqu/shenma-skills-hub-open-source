package com.skillstack.notification.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.notification.dto.NotificationPrefRes;
import com.skillstack.notification.dto.UpdateNotificationPrefsReq;
import com.skillstack.notification.entity.NotificationPref;
import com.skillstack.notification.mapper.NotificationPrefMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class NotificationPrefService {

    public static final List<String> INAPP_KEYS = List.of(
            "review_submitted",
            "review_result",
            "review_comment",
            "phone_invite",
            "suite_published",
            "team_member_change",
            "weekly_digest"
    );
    public static final List<String> EMAIL_KEYS = List.of(
            "review_result",
            "phone_invite",
            "weekly_digest"
    );
    public static final List<String> CHANNELS = List.of("inapp", "email");

    /** key|channel of items that default to ON. */
    private static final Set<String> DEFAULT_ON = Set.of(
            "review_submitted|inapp",
            "review_result|inapp",
            "review_comment|inapp",
            "phone_invite|inapp",
            "team_member_change|inapp",
            "weekly_digest|inapp",
            "review_result|email",
            "phone_invite|email"
    );

    private final NotificationPrefMapper mapper;
    private final TeamAccessGuard guard;

    public NotificationPrefRes get(Long teamId, Long userId) {
        guard.requireMember(teamId, userId);
        List<NotificationPref> rows = mapper.selectList(new LambdaQueryWrapper<NotificationPref>()
                .eq(NotificationPref::getTeamId, teamId)
                .eq(NotificationPref::getUserId, userId));
        Map<String, Boolean> rowMap = new HashMap<>();
        for (NotificationPref p : rows) {
            rowMap.put(p.getPrefKey() + "|" + p.getChannel(), Boolean.TRUE.equals(p.getEnabled()));
        }
        Map<String, Map<String, Boolean>> out = new LinkedHashMap<>();
        for (String k : INAPP_KEYS) {
            Map<String, Boolean> per = new LinkedHashMap<>();
            per.put("inapp", lookup(rowMap, k, "inapp"));
            if (EMAIL_KEYS.contains(k)) per.put("email", lookup(rowMap, k, "email"));
            out.put(k, per);
        }
        NotificationPrefRes res = new NotificationPrefRes();
        res.setPrefs(out);
        return res;
    }

    @Transactional
    public NotificationPrefRes update(Long teamId, Long userId, UpdateNotificationPrefsReq req) {
        guard.requireMember(teamId, userId);
        if (req == null || req.getEntries() == null) {
            throw new BusinessException(40001, "缺少 entries");
        }
        for (UpdateNotificationPrefsReq.Entry e : req.getEntries()) {
            if (e.getKey() == null || e.getChannel() == null || e.getEnabled() == null) {
                throw new BusinessException(40001, "字段缺失");
            }
            if (!INAPP_KEYS.contains(e.getKey())) {
                throw new BusinessException(40001, "未知偏好键: " + e.getKey());
            }
            if (!CHANNELS.contains(e.getChannel())) {
                throw new BusinessException(40001, "未知渠道: " + e.getChannel());
            }
            if ("email".equals(e.getChannel()) && !EMAIL_KEYS.contains(e.getKey())) {
                throw new BusinessException(40001, "该项不支持 email 渠道: " + e.getKey());
            }
            NotificationPref existing = mapper.selectOne(new LambdaQueryWrapper<NotificationPref>()
                    .eq(NotificationPref::getTeamId, teamId)
                    .eq(NotificationPref::getUserId, userId)
                    .eq(NotificationPref::getPrefKey, e.getKey())
                    .eq(NotificationPref::getChannel, e.getChannel()));
            if (existing == null) {
                NotificationPref row = new NotificationPref();
                row.setUserId(userId); row.setTeamId(teamId);
                row.setPrefKey(e.getKey()); row.setChannel(e.getChannel());
                row.setEnabled(e.getEnabled());
                mapper.insert(row);
            } else {
                existing.setEnabled(e.getEnabled());
                mapper.updateById(existing);
            }
        }
        return get(teamId, userId);
    }

    private boolean lookup(Map<String, Boolean> rowMap, String key, String channel) {
        String k = key + "|" + channel;
        if (rowMap.containsKey(k)) return rowMap.get(k);
        return DEFAULT_ON.contains(k);
    }

    /**
     * Returns whether the (key, channel) pair is enabled for the given user+team,
     * falling back to {@link #DEFAULT_ON} when the user has no row.
     *
     * <p>Used by NotificationService for delivery-time gating. Does NOT enforce
     * team membership — callers must already have validated that the recipient
     * should receive a team-scoped notification.</p>
     */
    public boolean isEnabled(Long userId, Long teamId, String prefKey, String channel) {
        if (userId == null || prefKey == null || channel == null) return false;
        LambdaQueryWrapper<NotificationPref> w = new LambdaQueryWrapper<NotificationPref>()
                .eq(NotificationPref::getUserId, userId)
                .eq(NotificationPref::getPrefKey, prefKey)
                .eq(NotificationPref::getChannel, channel);
        if (teamId != null) {
            w.eq(NotificationPref::getTeamId, teamId);
        } else {
            w.isNull(NotificationPref::getTeamId);
        }
        NotificationPref row = mapper.selectOne(w);
        if (row != null) return Boolean.TRUE.equals(row.getEnabled());
        return DEFAULT_ON.contains(prefKey + "|" + channel);
    }
}
