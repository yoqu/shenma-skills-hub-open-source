package com.skillstack.notification.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.web.PageResult;
import com.skillstack.notification.dto.NotificationItem;
import com.skillstack.notification.dto.NotificationQuery;
import com.skillstack.notification.entity.Notification;
import com.skillstack.notification.mapper.NotificationMapper;
import com.skillstack.team.entity.Team;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.team.service.TeamMemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationMapper mapper;
    private final NotificationPrefService prefService;
    private final TeamMemberService teamMemberService;
    private final TeamAccessGuard guard;
    private final UserMapper userMapper;
    private final TeamMapper teamMapper;

    /**
     * Write one notification row if the recipient's inapp pref is on.
     * Returns the row id, or null when delivery was suppressed.
     *
     * <p>Callers must already have ensured the recipient should logically receive
     * this notification (e.g., excluded the actor). Team-membership is enforced
     * here for all team-scoped types EXCEPT TEAM_REMOVED, where the recipient
     * has just been removed.</p>
     */
    @Transactional
    public Long notify(NotificationType type,
                       Long recipientId,
                       Long teamId,
                       Long actorId,
                       String title,
                       String body,
                       String targetUrl,
                       String sourceType,
                       Long sourceId) {
        if (recipientId == null) return null;
        if (actorId != null && actorId.equals(recipientId)) return null;
        if (teamId != null && type != NotificationType.TEAM_REMOVED) {
            if (!teamMemberService.isMember(teamId, recipientId)) return null;
        }
        if (!prefService.isEnabled(recipientId, teamId, type.prefKey(), "inapp")) return null;

        Notification n = new Notification();
        n.setUserId(recipientId);
        n.setTeamId(teamId);
        n.setType(type.name());
        n.setCategory(type.category());
        n.setTitle(title);
        n.setBody(body);
        n.setTargetUrl(targetUrl);
        n.setActorId(actorId);
        n.setSourceType(sourceType);
        n.setSourceId(sourceId);
        mapper.insert(n);
        return n.getId();
    }

    /** Fan-out helper for team-wide notifications (e.g., suite published). */
    public void notifyTeamMembers(NotificationType type,
                                  Long teamId,
                                  Long actorId,
                                  String title,
                                  String body,
                                  String targetUrl,
                                  String sourceType,
                                  Long sourceId,
                                  Collection<Long> recipientIds) {
        if (recipientIds == null) return;
        for (Long uid : recipientIds) {
            notify(type, uid, teamId, actorId, title, body, targetUrl, sourceType, sourceId);
        }
    }

    public PageResult<NotificationItem> listMine(Long userId, NotificationQuery q) {
        if (userId == null) throw new BusinessException(40100, "请先登录");
        if (q == null) q = new NotificationQuery();
        if (q.getTeamId() != null) guard.requireMember(q.getTeamId(), userId);
        String status = normalizeStatus(q.getStatus());
        long pageNo = Math.max(1, q.getPage());
        long pageSize = Math.min(100, Math.max(1, q.getSize()));

        Page<Notification> page = new Page<>(pageNo, pageSize);
        LambdaQueryWrapper<Notification> w = new LambdaQueryWrapper<Notification>()
                .eq(Notification::getUserId, userId)
                .orderByDesc(Notification::getCreatedAt);
        if (q.getTeamId() != null) w.eq(Notification::getTeamId, q.getTeamId());
        if ("unread".equals(status)) w.isNull(Notification::getReadAt);

        IPage<Notification> rows = mapper.selectPage(page, w);
        List<NotificationItem> items = new ArrayList<>(rows.getRecords().size());
        for (Notification r : rows.getRecords()) items.add(toItem(r));
        return PageResult.of(items, rows.getTotal(), rows.getCurrent(), rows.getSize());
    }

    public long unreadCount(Long userId, Long teamId) {
        if (userId == null) return 0;
        if (teamId != null) guard.requireMember(teamId, userId);
        LambdaQueryWrapper<Notification> w = new LambdaQueryWrapper<Notification>()
                .eq(Notification::getUserId, userId)
                .isNull(Notification::getReadAt);
        if (teamId != null) w.eq(Notification::getTeamId, teamId);
        return mapper.selectCount(w);
    }

    @Transactional
    public void markRead(Long userId, Long notificationId) {
        if (userId == null) throw new BusinessException(40100, "请先登录");
        Notification n = mapper.selectById(notificationId);
        if (n == null) throw new BusinessException(40400, "通知不存在");
        if (!userId.equals(n.getUserId())) throw new BusinessException(40300, "无权操作");
        if (n.getReadAt() != null) return;
        n.setReadAt(LocalDateTime.now());
        mapper.updateById(n);
    }

    @Transactional
    public int markAllRead(Long userId, Long teamId) {
        if (userId == null) throw new BusinessException(40100, "请先登录");
        if (teamId != null) guard.requireMember(teamId, userId);
        LambdaUpdateWrapper<Notification> w = new LambdaUpdateWrapper<Notification>()
                .eq(Notification::getUserId, userId)
                .isNull(Notification::getReadAt)
                .set(Notification::getReadAt, LocalDateTime.now());
        if (teamId != null) w.eq(Notification::getTeamId, teamId);
        return mapper.update(null, w);
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank() || "all".equals(status)) return "all";
        if ("unread".equals(status)) return "unread";
        throw new BusinessException(40001, "未知通知状态: " + status);
    }

    private NotificationItem toItem(Notification r) {
        NotificationItem it = new NotificationItem();
        it.setId(r.getId());
        it.setType(r.getType());
        it.setCategory(r.getCategory());
        it.setTitle(r.getTitle());
        it.setBody(r.getBody());
        it.setTeamId(r.getTeamId());
        it.setActorId(r.getActorId());
        it.setTargetUrl(r.getTargetUrl());
        it.setRead(r.getReadAt() != null);
        it.setCreatedAt(r.getCreatedAt());
        if (r.getTeamId() != null) {
            Team t = teamMapper.selectById(r.getTeamId());
            if (t != null) it.setTeamName(t.getName());
        }
        if (r.getActorId() != null) {
            User u = userMapper.selectById(r.getActorId());
            if (u != null) it.setActorName(u.getName());
        }
        return it;
    }
}
