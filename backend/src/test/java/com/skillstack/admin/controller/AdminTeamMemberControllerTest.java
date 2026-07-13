package com.skillstack.admin.controller;

import com.skillstack.admin.dto.AdminAddTeamMemberReq;
import com.skillstack.admin.dto.AdminUpdateTeamMemberRoleReq;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.common.web.PageQuery;
import com.skillstack.common.web.PageResult;
import com.skillstack.team.dto.TeamMemberRes;
import com.skillstack.team.entity.Team;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.team.mapper.TeamMemberMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 验证 {@link AdminTeamMemberController} 的写接口在通过超管校验后的行为。
 *
 * <p>采用直接调用 controller 的方式（参考 {@code NotificationControllerTest}）：
 * 这套测试用 {@code @Transactional} 创建独立的 super-admin、team、owner、candidate 数据，
 * 避开了 MockMvc + @WithMockUser 无法满足 {@code SuperAdminAspect} 对
 * {@code Authentication.getPrincipal() instanceof CurrentUser} 的要求的问题。</p>
 */
@SpringBootTest
@Transactional
class AdminTeamMemberControllerTest {

    @Autowired AdminTeamMemberController controller;
    @Autowired UserMapper userMapper;
    @Autowired TeamMapper teamMapper;
    @Autowired TeamMemberMapper teamMemberMapper;

    Long superAdminId;
    Long teamId;
    Long ownerId;
    Long candidateId;

    @BeforeEach
    void setup() {
        // 1) 平台超管
        User sa = newUser("sa_");
        sa.setPlatformRole("SUPER_ADMIN");
        sa.setStatus("ACTIVE");
        userMapper.updateById(sa);
        superAdminId = sa.getId();

        // 2) team + owner
        User owner = newUser("owner_");
        ownerId = owner.getId();
        Team t = new Team();
        t.setSlug("admmem_" + System.nanoTime());
        t.setName("ADM-MEM-TEAM");
        t.setOwnerId(ownerId);
        t.setMembersCount(1);
        teamMapper.insert(t);
        teamId = t.getId();
        TeamMember om = new TeamMember();
        om.setTeamId(teamId);
        om.setUserId(ownerId);
        om.setRole("OWNER");
        teamMemberMapper.insert(om);

        // 3) 候选成员（尚未加入团队）
        candidateId = newUser("cand_").getId();

        // 在 SecurityContext 注入 super-admin 身份，让 RequireSuperAdmin 切面通过
        loginAsSuperAdmin();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void list_returns_members() {
        ApiResponse<PageResult<TeamMemberRes>> resp =
                controller.list(teamId, null, null, new PageQuery(), currentUser(superAdminId));
        assertEquals(0, resp.getCode());
        assertNotNull(resp.getData());
        assertTrue(resp.getData().getTotal() >= 1);
    }

    @Test
    void add_member_succeeds_then_idempotent() {
        AdminAddTeamMemberReq req = new AdminAddTeamMemberReq();
        req.setUserId(candidateId);
        req.setRole("MEMBER");

        ApiResponse<Void> r1 = controller.add(teamId, req, currentUser(superAdminId));
        assertEquals(0, r1.getCode());

        // 第二次添加：addMember 内部已做幂等（存在直接返回），controller 仍返回 0
        ApiResponse<Void> r2 = controller.add(teamId, req, currentUser(superAdminId));
        assertEquals(0, r2.getCode());
    }

    @Test
    void update_role_to_member_works() {
        // 先加入团队为 MEMBER
        AdminAddTeamMemberReq add = new AdminAddTeamMemberReq();
        add.setUserId(candidateId);
        add.setRole("MEMBER");
        controller.add(teamId, add, currentUser(superAdminId));

        // 升为 ADMIN
        AdminUpdateTeamMemberRoleReq up = new AdminUpdateTeamMemberRoleReq();
        up.setRole("ADMIN");
        ApiResponse<Void> resp = controller.updateRole(teamId, candidateId, up, currentUser(superAdminId));
        assertEquals(0, resp.getCode());

        TeamMember after = teamMemberMapper.selectOne(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<TeamMember>()
                        .eq(TeamMember::getTeamId, teamId)
                        .eq(TeamMember::getUserId, candidateId));
        assertEquals("ADMIN", after.getRole());
    }

    @Test
    void remove_owner_rejected() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> controller.remove(teamId, ownerId, currentUser(superAdminId)));
        assertEquals(40300, ex.getCode());
    }

    /* ---------- helpers ---------- */

    private User newUser(String prefix) {
        User u = new User();
        long n = System.nanoTime();
        u.setHandle(prefix + n);
        u.setName(prefix + "name");
        u.setEmail(u.getHandle() + "@t.local");
        u.setPasswordHash("x");
        userMapper.insert(u);
        return u;
    }

    private CurrentUser currentUser(Long uid) {
        return new CurrentUser(uid, "test", false);
    }

    private void loginAsSuperAdmin() {
        CurrentUser cu = currentUser(superAdminId);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(cu, null, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
