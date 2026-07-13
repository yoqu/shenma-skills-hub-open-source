package com.skillstack.notification.service;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.notification.entity.Notification;
import com.skillstack.notification.mapper.NotificationMapper;
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
class NotificationServiceTest {

    @Autowired NotificationService service;
    @Autowired NotificationMapper mapper;
    @Autowired UserMapper userMapper;
    @Autowired TeamMapper teamMapper;
    @Autowired TeamMemberMapper teamMemberMapper;
    @Autowired NotificationPrefService prefService;

    Long teamId; Long ownerId; Long memberId; Long outsiderId;

    @BeforeEach
    void setup() {
        User owner = new User();
        owner.setHandle("owner_" + System.nanoTime());
        owner.setName("O"); owner.setEmail(owner.getHandle() + "@t"); owner.setPasswordHash("x");
        userMapper.insert(owner); ownerId = owner.getId();

        User mem = new User();
        mem.setHandle("mem_" + System.nanoTime());
        mem.setName("M"); mem.setEmail(mem.getHandle() + "@t"); mem.setPasswordHash("x");
        userMapper.insert(mem); memberId = mem.getId();

        User outsider = new User();
        outsider.setHandle("outsider_" + System.nanoTime());
        outsider.setName("X"); outsider.setEmail(outsider.getHandle() + "@t"); outsider.setPasswordHash("x");
        userMapper.insert(outsider); outsiderId = outsider.getId();

        Team t = new Team(); t.setSlug("nt_" + System.nanoTime()); t.setName("T");
        t.setOwnerId(ownerId); t.setMembersCount(2);
        teamMapper.insert(t); teamId = t.getId();

        TeamMember om = new TeamMember(); om.setTeamId(teamId); om.setUserId(ownerId); om.setRole("OWNER");
        teamMemberMapper.insert(om);
        TeamMember mm = new TeamMember(); mm.setTeamId(teamId); mm.setUserId(memberId); mm.setRole("MEMBER");
        teamMemberMapper.insert(mm);
    }

    @Test
    void notify_writes_row_for_recipient_with_default_pref_on() {
        Long id = service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, ownerId,
                "你的 Skill 审核已通过", "demo-skill v1.0.0 已发布", "/team/mine",
                "review", 42L);
        assertNotNull(id);
        Notification row = mapper.selectById(id);
        assertEquals(memberId, row.getUserId());
        assertEquals("REVIEW_APPROVED", row.getType());
        assertEquals("review", row.getCategory());
        assertNull(row.getReadAt());
    }

    @Test
    void list_filters_by_status_and_marks_read() {
        Long id1 = service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, ownerId,
                "t1", "b1", "/team/mine", "review", 1L);
        Long id2 = service.notify(NotificationType.REVIEW_REJECTED, memberId, teamId, ownerId,
                "t2", "b2", "/team/mine", "review", 2L);

        com.skillstack.notification.dto.NotificationQuery q = new com.skillstack.notification.dto.NotificationQuery();
        q.setStatus("all"); q.setTeamId(teamId); q.setPage(1); q.setSize(10);
        com.skillstack.common.web.PageResult<com.skillstack.notification.dto.NotificationItem> all =
                service.listMine(memberId, q);
        assertEquals(2, all.getTotal());

        assertEquals(2L, service.unreadCount(memberId, null));
        service.markRead(memberId, id1);
        assertEquals(1L, service.unreadCount(memberId, null));

        q.setStatus("unread");
        com.skillstack.common.web.PageResult<com.skillstack.notification.dto.NotificationItem> unread =
                service.listMine(memberId, q);
        assertEquals(1, unread.getTotal());
        assertEquals(id2, unread.getItems().get(0).getId());
    }

    @Test
    void mark_read_rejects_other_users_row() {
        Long id = service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, ownerId,
                "x", "y", "/", "review", 9L);
        assertThrows(com.skillstack.common.exception.BusinessException.class,
                () -> service.markRead(ownerId, id));
    }

    @Test
    void mark_all_read_scoped_to_team_id() {
        service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, ownerId,
                "t1", "b1", "/", "review", 1L);
        service.notify(NotificationType.REVIEW_REJECTED, memberId, null, ownerId,
                "t2", "b2", "/", "review", 2L);
        int affected = service.markAllRead(memberId, teamId);
        assertEquals(1, affected);
        assertEquals(1L, service.unreadCount(memberId, null));
    }

    @Test
    void mark_all_read_without_team_id_marks_every_unread_row_for_user() {
        service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, ownerId,
                "t1", "b1", "/", "review", 1L);
        service.notify(NotificationType.REVIEW_REJECTED, memberId, null, ownerId,
                "t2", "b2", "/", "review", 2L);
        int affected = service.markAllRead(memberId, null);
        assertEquals(2, affected);
        assertEquals(0L, service.unreadCount(memberId, null));
    }

    @Test
    void unread_count_rejects_team_scope_for_non_member() {
        assertThrows(com.skillstack.common.exception.BusinessException.class,
                () -> service.unreadCount(outsiderId, teamId));
    }

    @Test
    void list_rejects_unknown_status() {
        com.skillstack.notification.dto.NotificationQuery q = new com.skillstack.notification.dto.NotificationQuery();
        q.setStatus("archived");
        assertThrows(com.skillstack.common.exception.BusinessException.class,
                () -> service.listMine(memberId, q));
    }

    @Test
    void notify_suppressed_when_pref_off() {
        com.skillstack.notification.dto.UpdateNotificationPrefsReq req =
                new com.skillstack.notification.dto.UpdateNotificationPrefsReq();
        com.skillstack.notification.dto.UpdateNotificationPrefsReq.Entry e =
                new com.skillstack.notification.dto.UpdateNotificationPrefsReq.Entry();
        e.setKey("review_result"); e.setChannel("inapp"); e.setEnabled(false);
        req.setEntries(java.util.List.of(e));
        prefService.update(teamId, memberId, req);

        Long id = service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, ownerId,
                "t", "b", "/", "review", 3L);
        assertNull(id);
    }

    @Test
    void notify_suppressed_when_actor_equals_recipient() {
        Long id = service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, memberId,
                "t", "b", "/", "review", 4L);
        assertNull(id);
    }
}
