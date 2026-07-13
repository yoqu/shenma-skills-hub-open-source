package com.skillstack.notification.controller;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.common.web.PageResult;
import com.skillstack.notification.dto.NotificationItem;
import com.skillstack.notification.dto.NotificationQuery;
import com.skillstack.notification.dto.NotificationReadAllRes;
import com.skillstack.notification.dto.NotificationUnreadCountRes;
import com.skillstack.notification.service.NotificationService;
import com.skillstack.notification.service.NotificationType;
import com.skillstack.team.entity.Team;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.team.mapper.TeamMemberMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class NotificationControllerTest {

    @Autowired NotificationController controller;
    @Autowired NotificationService service;
    @Autowired UserMapper userMapper;
    @Autowired TeamMapper teamMapper;
    @Autowired TeamMemberMapper teamMemberMapper;

    Long teamId; Long ownerId; Long memberId;

    @BeforeEach
    void setup() {
        User a = new User(); a.setHandle("a_" + System.nanoTime()); a.setName("A");
        a.setEmail(a.getHandle() + "@t"); a.setPasswordHash("x");
        userMapper.insert(a); ownerId = a.getId();
        User b = new User(); b.setHandle("b_" + System.nanoTime()); b.setName("B");
        b.setEmail(b.getHandle() + "@t"); b.setPasswordHash("x");
        userMapper.insert(b); memberId = b.getId();
        Team t = new Team(); t.setSlug("nc_" + System.nanoTime()); t.setName("T");
        t.setOwnerId(ownerId); t.setMembersCount(2);
        teamMapper.insert(t); teamId = t.getId();
        TeamMember om = new TeamMember(); om.setTeamId(teamId); om.setUserId(ownerId); om.setRole("OWNER");
        teamMemberMapper.insert(om);
        TeamMember mm = new TeamMember(); mm.setTeamId(teamId); mm.setUserId(memberId); mm.setRole("MEMBER");
        teamMemberMapper.insert(mm);
    }

    private CurrentUser as(Long uid) {
        CurrentUser cu = new CurrentUser();
        cu.setId(uid);
        return cu;
    }

    @Test
    void list_unread_and_mark_read_round_trip() {
        Long id = service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, ownerId,
                "t", "b", "/", "review", 1L);

        NotificationQuery q = new NotificationQuery();
        q.setStatus("unread"); q.setPage(1); q.setSize(10);
        ApiResponse<PageResult<NotificationItem>> resp = controller.list(q, as(memberId));
        assertEquals(0, resp.getCode());
        assertEquals(1, resp.getData().getTotal());

        ApiResponse<NotificationUnreadCountRes> cnt = controller.unreadCount(null, as(memberId));
        assertEquals(1, cnt.getData().getUnread());

        controller.markRead(id, as(memberId));
        assertEquals(0, controller.unreadCount(null, as(memberId)).getData().getUnread());
    }

    @Test
    void mark_all_read_returns_affected_count() {
        service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, ownerId,
                "t1", "b1", "/", "review", 1L);
        service.notify(NotificationType.REVIEW_REJECTED, memberId, teamId, ownerId,
                "t2", "b2", "/", "review", 2L);

        ApiResponse<NotificationReadAllRes> resp = controller.markAllRead(teamId, as(memberId));

        assertEquals(0, resp.getCode());
        assertEquals(2, resp.getData().getUpdated());
        assertEquals(0, controller.unreadCount(teamId, as(memberId)).getData().getUnread());
    }
}
