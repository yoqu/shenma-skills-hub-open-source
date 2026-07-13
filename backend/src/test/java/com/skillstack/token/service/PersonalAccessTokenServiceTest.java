package com.skillstack.token.service;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.team.entity.Team;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.team.mapper.TeamMemberMapper;
import com.skillstack.token.dto.CreateTokenReq;
import com.skillstack.token.dto.CreateTokenRes;
import com.skillstack.token.dto.TokenItemRes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class PersonalAccessTokenServiceTest {

    @Autowired PersonalAccessTokenService svc;
    @Autowired UserMapper userMapper;
    @Autowired TeamMapper teamMapper;
    @Autowired TeamMemberMapper teamMemberMapper;

    Long userId; Long teamId;

    @BeforeEach
    void setup() {
        User u = new User();
        u.setHandle("pat_" + System.nanoTime());
        u.setName("X"); u.setEmail(u.getHandle() + "@t.local"); u.setPasswordHash("x");
        userMapper.insert(u); userId = u.getId();
        Team t = new Team(); t.setSlug("pat_" + System.nanoTime()); t.setName("T"); t.setOwnerId(userId); t.setMembersCount(1);
        teamMapper.insert(t); teamId = t.getId();
        TeamMember m = new TeamMember(); m.setTeamId(teamId); m.setUserId(userId); m.setRole("OWNER");
        teamMemberMapper.insert(m);
    }

    @Test
    void create_returns_secret_starts_with_prefix_and_only_once() {
        CreateTokenReq req = new CreateTokenReq();
        req.setName("MacBook 本机");
        req.setKind("personal");
        CreateTokenRes res = svc.create(teamId, userId, req);
        assertTrue(res.getSecret().startsWith("lst_"));
        assertTrue(res.getSecret().length() >= 32);
        // list 时不应再返回明文
        List<TokenItemRes> list = svc.list(teamId, userId);
        assertEquals(1, list.size());
        assertTrue(list.get(0).getMasked().startsWith(res.getSecret().substring(0, 12)));
        assertFalse(list.get(0).getMasked().contains(res.getSecret().substring(12)));
    }

    @Test
    void revoke_marks_token_inactive_and_authenticate_fails() {
        CreateTokenRes res = svc.create(teamId, userId, new CreateTokenReq() {{
            setName("CI"); setKind("ci");
        }});
        // 吊销前能 resolve
        assertNotNull(svc.resolveActive(res.getSecret()));
        svc.revoke(teamId, userId, res.getId());
        assertNull(svc.resolveActive(res.getSecret()));
    }

    @Test
    void resolveActive_updates_lastUsedAt() {
        CreateTokenRes res = svc.create(teamId, userId, new CreateTokenReq() {{
            setName("ci"); setKind("ci");
        }});
        var active = svc.resolveActive(res.getSecret());
        assertNotNull(active);
        assertEquals(userId, active.getUserId());
        assertEquals(teamId, active.getTeamId());
        // 第二次调用 last_used_at 应被刷新（>= 第一次）
        var second = svc.resolveActive(res.getSecret());
        assertNotNull(second.getLastUsedAt());
    }

    @Test
    void list_hides_other_users_tokens() {
        svc.create(teamId, userId, new CreateTokenReq() {{ setName("mine"); setKind("personal"); }});
        // 另一个用户
        User other = new User();
        other.setHandle("o_" + System.nanoTime()); other.setName("o");
        other.setEmail(other.getHandle()+"@t.local"); other.setPasswordHash("x");
        userMapper.insert(other);
        TeamMember m = new TeamMember(); m.setTeamId(teamId); m.setUserId(other.getId()); m.setRole("MEMBER");
        teamMemberMapper.insert(m);
        assertEquals(0, svc.list(teamId, other.getId()).size());
    }
}
