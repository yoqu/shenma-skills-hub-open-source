package com.skillstack.notification.service;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.notification.dto.NotificationPrefRes;
import com.skillstack.notification.dto.UpdateNotificationPrefsReq;
import com.skillstack.team.entity.Team;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.team.mapper.TeamMemberMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class NotificationPrefServiceTest {

    @Autowired NotificationPrefService service;
    @Autowired UserMapper userMapper;
    @Autowired TeamMapper teamMapper;
    @Autowired TeamMemberMapper teamMemberMapper;

    Long userId; Long teamId;

    @BeforeEach
    void setup() {
        User u = new User();
        u.setHandle("np_" + System.nanoTime());
        u.setName("X"); u.setEmail(u.getHandle() + "@t.local"); u.setPasswordHash("x");
        userMapper.insert(u); userId = u.getId();
        Team t = new Team(); t.setSlug("np_" + System.nanoTime()); t.setName("T"); t.setOwnerId(userId); t.setMembersCount(1);
        teamMapper.insert(t); teamId = t.getId();
        TeamMember m = new TeamMember(); m.setTeamId(teamId); m.setUserId(userId); m.setRole("OWNER");
        teamMemberMapper.insert(m);
    }

    @Test
    void get_returns_defaults_when_no_rows() {
        NotificationPrefRes res = service.get(teamId, userId);
        assertEquals(Boolean.TRUE,  res.getPrefs().get("review_submitted").get("inapp"));
        assertEquals(Boolean.TRUE,  res.getPrefs().get("review_result").get("inapp"));
        assertEquals(Boolean.TRUE,  res.getPrefs().get("review_result").get("email"));
        assertEquals(Boolean.TRUE,  res.getPrefs().get("review_comment").get("inapp"));
        assertEquals(Boolean.TRUE,  res.getPrefs().get("phone_invite").get("inapp"));
        assertEquals(Boolean.TRUE,  res.getPrefs().get("phone_invite").get("email"));
        assertEquals(Boolean.FALSE, res.getPrefs().get("suite_published").get("inapp"));
        assertEquals(Boolean.TRUE,  res.getPrefs().get("team_member_change").get("inapp"));
        assertEquals(Boolean.TRUE,  res.getPrefs().get("weekly_digest").get("inapp"));
        assertFalse(res.getPrefs().get("review_comment").containsKey("email")); // not email-supported
    }

    @Test
    void update_then_get_round_trips() {
        UpdateNotificationPrefsReq req = new UpdateNotificationPrefsReq();
        UpdateNotificationPrefsReq.Entry e = new UpdateNotificationPrefsReq.Entry();
        e.setKey("review_result"); e.setChannel("inapp"); e.setEnabled(false);
        req.setEntries(List.of(e));
        service.update(teamId, userId, req);
        NotificationPrefRes res = service.get(teamId, userId);
        assertEquals(Boolean.FALSE, res.getPrefs().get("review_result").get("inapp"));
        // 其它项仍为默认
        assertEquals(Boolean.TRUE, res.getPrefs().get("review_result").get("email"));
    }

    @Test
    void update_rejects_unknown_key_or_channel() {
        UpdateNotificationPrefsReq req = new UpdateNotificationPrefsReq();
        UpdateNotificationPrefsReq.Entry e = new UpdateNotificationPrefsReq.Entry();
        e.setKey("hacker_key"); e.setChannel("inapp"); e.setEnabled(true);
        req.setEntries(List.of(e));
        assertThrows(RuntimeException.class, () -> service.update(teamId, userId, req));
    }

    @Test
    void update_rejects_legacy_mention_key() {
        UpdateNotificationPrefsReq req = new UpdateNotificationPrefsReq();
        UpdateNotificationPrefsReq.Entry e = new UpdateNotificationPrefsReq.Entry();
        e.setKey("mention"); e.setChannel("inapp"); e.setEnabled(true);
        req.setEntries(List.of(e));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.update(teamId, userId, req));
        assertTrue(ex.getMessage().contains("未知偏好键"));
    }
}
