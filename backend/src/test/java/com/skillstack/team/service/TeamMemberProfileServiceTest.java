package com.skillstack.team.service;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.team.dto.TeamMemberProfileRes;
import com.skillstack.team.dto.UpdateTeamMemberProfileReq;
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
class TeamMemberProfileServiceTest {

    @Autowired TeamMemberProfileService service;
    @Autowired UserMapper userMapper;
    @Autowired TeamMapper teamMapper;
    @Autowired TeamMemberMapper teamMemberMapper;

    Long userId;
    Long teamId;

    @BeforeEach
    void setup() {
        User u = new User();
        u.setHandle("tmp_user_" + System.nanoTime());
        u.setName("张三");
        u.setEmail(u.getHandle() + "@test.local");
        u.setPasswordHash("x");
        userMapper.insert(u);
        userId = u.getId();

        Team t = new Team();
        t.setSlug("tmp_team_" + System.nanoTime());
        t.setName("临时团队");
        t.setOwnerId(userId);
        t.setMembersCount(1);
        teamMapper.insert(t);
        teamId = t.getId();

        TeamMember m = new TeamMember();
        m.setTeamId(teamId);
        m.setUserId(userId);
        m.setRole("OWNER");
        teamMemberMapper.insert(m);
    }

    @Test
    void getProfile_falls_back_to_account_when_no_team_profile_row() {
        TeamMemberProfileRes res = service.get(teamId, userId, userId);
        assertEquals("张三", res.getDisplayName());
        assertFalse(res.getShowEmail());
        assertNotNull(res.getEmail()); // self always sees own email
    }

    @Test
    void updateProfile_creates_then_updates_row() {
        UpdateTeamMemberProfileReq req = new UpdateTeamMemberProfileReq();
        req.setDisplayName("阿三");
        req.setBio("前端工程");
        req.setShowEmail(true);
        TeamMemberProfileRes after = service.update(teamId, userId, req);
        assertEquals("阿三", after.getDisplayName());
        assertEquals("前端工程", after.getBio());
        assertTrue(after.getShowEmail());

        req.setDisplayName("阿四");
        req.setBio(null);
        req.setShowEmail(false);
        TeamMemberProfileRes second = service.update(teamId, userId, req);
        assertEquals("阿四", second.getDisplayName());
        assertNull(second.getBio());
        assertFalse(second.getShowEmail());
    }

    @Test
    void getProfile_for_other_member_hides_email_when_showEmail_false() {
        // create second user/member
        User other = new User();
        other.setHandle("other_" + System.nanoTime());
        other.setName("李四");
        other.setEmail(other.getHandle() + "@test.local");
        other.setPasswordHash("x");
        userMapper.insert(other);

        TeamMember om = new TeamMember();
        om.setTeamId(teamId);
        om.setUserId(other.getId());
        om.setRole("MEMBER");
        teamMemberMapper.insert(om);

        TeamMemberProfileRes seenByOwner = service.get(teamId, other.getId(), userId);
        // owner is writer, should always see email
        assertNotNull(seenByOwner.getEmail());

        TeamMemberProfileRes seenByOther = service.get(teamId, userId, other.getId());
        // owner.showEmail == false (default) → other member must NOT see email
        assertNull(seenByOther.getEmail());
    }
}
