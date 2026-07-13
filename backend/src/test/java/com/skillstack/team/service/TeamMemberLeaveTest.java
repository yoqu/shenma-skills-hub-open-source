package com.skillstack.team.service;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.team.entity.Team;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.team.mapper.TeamMemberMapper;
import com.skillstack.token.dto.CreateTokenReq;
import com.skillstack.token.dto.CreateTokenRes;
import com.skillstack.token.service.PersonalAccessTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class TeamMemberLeaveTest {

    @Autowired TeamMemberService svc;
    @Autowired UserMapper userMapper;
    @Autowired TeamMapper teamMapper;
    @Autowired TeamMemberMapper teamMemberMapper;
    @Autowired PersonalAccessTokenService patService;

    @Test
    void member_can_leave_and_pats_are_revoked() {
        User owner = makeUser(); User m = makeUser();
        Team t = makeTeam(owner.getId(), 2);
        addMember(t.getId(), owner.getId(), "OWNER");
        addMember(t.getId(), m.getId(), "MEMBER");
        CreateTokenReq req = new CreateTokenReq(); req.setName("x"); req.setKind("personal");
        CreateTokenRes tok = patService.create(t.getId(), m.getId(), req);

        svc.leave(t.getId(), m.getId());

        assertFalse(svc.isMember(t.getId(), m.getId()));
        assertNull(patService.resolveActive(tok.getSecret()));
        Team after = teamMapper.selectById(t.getId());
        assertEquals(1, after.getMembersCount());
    }

    @Test
    void sole_owner_cannot_leave() {
        User owner = makeUser();
        Team t = makeTeam(owner.getId(), 1);
        addMember(t.getId(), owner.getId(), "OWNER");
        assertThrows(BusinessException.class, () -> svc.leave(t.getId(), owner.getId()));
    }

    @Test
    void owner_can_leave_when_another_owner_exists() {
        User o1 = makeUser(); User o2 = makeUser();
        Team t = makeTeam(o1.getId(), 2);
        addMember(t.getId(), o1.getId(), "OWNER");
        addMember(t.getId(), o2.getId(), "OWNER");
        svc.leave(t.getId(), o1.getId());
        assertFalse(svc.isMember(t.getId(), o1.getId()));
    }

    private User makeUser() {
        User u = new User();
        u.setHandle("lv_"+System.nanoTime()); u.setName("X");
        u.setEmail(u.getHandle()+"@t.local"); u.setPasswordHash("x");
        userMapper.insert(u);
        return u;
    }
    private Team makeTeam(Long ownerId, int members) {
        Team t = new Team();
        t.setSlug("lv_"+System.nanoTime()); t.setName("T");
        t.setOwnerId(ownerId); t.setMembersCount(members);
        teamMapper.insert(t);
        return t;
    }
    private void addMember(Long teamId, Long userId, String role) {
        TeamMember m = new TeamMember(); m.setTeamId(teamId); m.setUserId(userId); m.setRole(role);
        teamMemberMapper.insert(m);
    }
}
