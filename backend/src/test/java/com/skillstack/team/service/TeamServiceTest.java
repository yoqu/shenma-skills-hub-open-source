package com.skillstack.team.service;

import com.skillstack.auth.entity.User;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.PermissionService;
import com.skillstack.common.storage.StorageService;
import com.skillstack.common.storage.StorageUrlResolver;
import com.skillstack.skill.mapper.SkillMapper;
import com.skillstack.team.entity.Team;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.team.mapper.TeamMemberMapper;

import java.util.Collections;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Consolidated service layer tests for TeamService.
 * Includes functional behavior and permission boundary tests.
 */
class TeamServiceTest {

    private TeamService teamService;
    private TeamMapper teamMapper;
    private TeamMemberMapper teamMemberMapper;
    private SkillMapper skillMapper;
    private StorageService storageService;

    @BeforeEach
    void setUp() {
        teamMapper = mock(TeamMapper.class);
        teamMemberMapper = mock(TeamMemberMapper.class);
        skillMapper = mock(SkillMapper.class);
        storageService = mock(StorageService.class);
        when(skillMapper.countByTeamGroupByVisibility(any())).thenReturn(Collections.emptyList());
        teamService = new TeamService(teamMapper, teamMemberMapper, skillMapper, storageService,
                mock(StorageUrlResolver.class), mock(PermissionService.class));
    }

    // ==================== Permission Tests ====================

    @Test
    void testRequireMembership_WithoutMembership_ThrowsForbidden() {
        // Arrange: User is not a team member
        Long teamId = 1L;
        Long userId = 100L;

        Team team = new Team();
        team.setId(teamId);
        team.setName("Test Team");
        when(teamMapper.selectById(teamId)).thenReturn(team);
        when(teamMemberMapper.selectOne(any())).thenReturn(null);

        // Act & Assert
        BusinessException ex = assertThrows(BusinessException.class, () -> {
            teamService.requireMembership(teamId, userId);
        });

        assertTrue(ex.getMessage().contains("T_FORBIDDEN"));
        assertTrue(ex.getMessage().contains("不是该团队成员"));
    }

    @Test
    void testRequireMembership_WithMembership_ReturnsMember() {
        // Arrange: User is a team member
        Long teamId = 1L;
        Long userId = 100L;

        TeamMember member = new TeamMember();
        member.setTeamId(teamId);
        member.setUserId(userId);
        member.setRole("MEMBER");
        when(teamMemberMapper.selectOne(any())).thenReturn(member);

        // Act
        TeamMember result = teamService.requireMembership(teamId, userId);

        // Assert
        assertEquals(member, result);
        assertEquals("MEMBER", result.getRole());
    }

    @Test
    void testRequireWriter_NonMember_ThrowsForbidden() {
        // Arrange: User is not a team member
        Long teamId = 1L;
        Long userId = 100L;

        Team team = new Team();
        team.setId(teamId);
        when(teamMapper.selectById(teamId)).thenReturn(team);
        when(teamMemberMapper.selectOne(any())).thenReturn(null);

        // Act & Assert
        BusinessException ex = assertThrows(BusinessException.class, () -> {
            teamService.requireWriter(teamId, userId);
        });

        assertTrue(ex.getMessage().contains("T_FORBIDDEN"));
    }

    @Test
    void testRequireWriter_MemberRole_ThrowsForbidden() {
        // Arrange: User is a member but not admin
        Long teamId = 1L;
        Long userId = 100L;

        Team team = new Team();
        team.setId(teamId);
        when(teamMapper.selectById(teamId)).thenReturn(team);

        TeamMember member = new TeamMember();
        member.setTeamId(teamId);
        member.setUserId(userId);
        member.setRole("MEMBER");
        when(teamMemberMapper.selectOne(any())).thenReturn(member);

        // Act & Assert
        BusinessException ex = assertThrows(BusinessException.class, () -> {
            teamService.requireWriter(teamId, userId);
        });

        assertTrue(ex.getMessage().contains("T_FORBIDDEN"));
        assertTrue(ex.getMessage().contains("ADMIN"));
    }

    @Test
    void testRequireWriter_AdminRole_ReturnsSuccess() {
        // Arrange: User is an admin
        Long teamId = 1L;
        Long userId = 100L;

        Team team = new Team();
        team.setId(teamId);
        when(teamMapper.selectById(teamId)).thenReturn(team);

        TeamMember admin = new TeamMember();
        admin.setTeamId(teamId);
        admin.setUserId(userId);
        admin.setRole("ADMIN");
        when(teamMemberMapper.selectOne(any())).thenReturn(admin);

        // Act
        TeamMember result = teamService.requireWriter(teamId, userId);

        // Assert
        assertEquals(admin, result);
        assertEquals("ADMIN", result.getRole());
    }

    @Test
    void testRequireWriter_OwnerRole_ReturnsSuccess() {
        // Arrange: User is an owner
        Long teamId = 1L;
        Long userId = 100L;

        Team team = new Team();
        team.setId(teamId);
        when(teamMapper.selectById(teamId)).thenReturn(team);

        TeamMember owner = new TeamMember();
        owner.setTeamId(teamId);
        owner.setUserId(userId);
        owner.setRole("OWNER");
        when(teamMemberMapper.selectOne(any())).thenReturn(owner);

        // Act
        TeamMember result = teamService.requireWriter(teamId, userId);

        // Assert
        assertEquals(owner, result);
        assertEquals("OWNER", result.getRole());
    }

    @Test
    void testRequireWriter_ViewerRole_ThrowsForbidden() {
        // Arrange: User has viewer role (read-only)
        Long teamId = 1L;
        Long userId = 100L;

        Team team = new Team();
        team.setId(teamId);
        when(teamMapper.selectById(teamId)).thenReturn(team);

        TeamMember viewer = new TeamMember();
        viewer.setTeamId(teamId);
        viewer.setUserId(userId);
        viewer.setRole("VIEWER");
        when(teamMemberMapper.selectOne(any())).thenReturn(viewer);

        // Act & Assert
        BusinessException ex = assertThrows(BusinessException.class, () -> {
            teamService.requireWriter(teamId, userId);
        });

        assertTrue(ex.getMessage().contains("T_FORBIDDEN"));
    }

    @Test
    void testIsValidRole_WithValidRoles() {
        // Assert
        assertTrue(TeamService.isValidRole("OWNER"));
        assertTrue(TeamService.isValidRole("ADMIN"));
        assertTrue(TeamService.isValidRole("MEMBER"));
        assertTrue(TeamService.isValidRole("VIEWER"));
    }

    @Test
    void testIsValidRole_WithInvalidRole() {
        // Assert
        assertFalse(TeamService.isValidRole("INVALID"));
        assertFalse(TeamService.isValidRole("guest"));
        assertFalse(TeamService.isValidRole(null));
    }

    // ==================== createTeam Tests ====================

    @Test
    void createTeam_createsTeamAndOwnerMember() {
        Long userId = 42L;
        String name = "My Team";

        // 没有 slug 冲突
        when(teamMapper.selectCount(any())).thenReturn(0L);
        when(teamMapper.insert(any())).thenAnswer(inv -> {
            Team t = inv.getArgument(0);
            t.setId(1L);
            return 1;
        });
        when(teamMemberMapper.insert(any())).thenReturn(1);

        var res = teamService.createTeam(userId, name);

        assertNotNull(res);
        assertEquals("My Team", res.getName());
        assertEquals("my-team", res.getSlug());

        // 验证 team_members 写入了 OWNER
        var memberCaptor = org.mockito.ArgumentCaptor.forClass(TeamMember.class);
        verify(teamMemberMapper).insert(memberCaptor.capture());
        assertEquals("OWNER", memberCaptor.getValue().getRole());
        assertEquals(userId, memberCaptor.getValue().getUserId());
    }

    @Test
    void createTeam_slugCollision_appendsCounter() {
        Long userId = 1L;

        // 第一次 selectCount 返回 1（冲突），第二次返回 0（可用）
        when(teamMapper.selectCount(any()))
                .thenReturn(1L)
                .thenReturn(0L);
        when(teamMapper.insert(any())).thenAnswer(inv -> {
            Team t = inv.getArgument(0);
            t.setId(2L);
            return 1;
        });
        when(teamMemberMapper.insert(any())).thenReturn(1);

        var res = teamService.createTeam(userId, "My Team");

        assertEquals("my-team-1", res.getSlug());
    }

    @Test
    void createTeam_chineseNameWithoutEnglishSlugIsRejected() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> teamService.createTeam(1L, "前端平台组"));

        assertEquals(40000, ex.getCode());
        assertTrue(ex.getMessage().contains("英文标识"));
        verify(teamMapper, never()).insert(any());
    }

    @Test
    void uploadLogo_withAdminStoresLogoAndReturnsResolvedUrl() throws Exception {
        Long teamId = 1L;
        Long userId = 100L;
        Team team = new Team();
        team.setId(teamId);
        team.setLogoUrl("teams/1/logo/old.png");

        TeamMember admin = new TeamMember();
        admin.setTeamId(teamId);
        admin.setUserId(userId);
        admin.setRole("ADMIN");

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "logo.png",
                "image/png",
                new byte[]{1, 2, 3}
        );

        when(teamMemberMapper.selectOne(any())).thenReturn(admin);
        when(teamMapper.selectById(teamId)).thenReturn(team);
        when(storageService.store(file, "teams/1/logo")).thenReturn("teams/1/logo/new.png");
        when(storageService.resolveUrl("teams/1/logo/new.png")).thenReturn("/uploads/teams/1/logo/new.png");

        String url = teamService.uploadLogo(teamId, userId, file);

        assertEquals("/uploads/teams/1/logo/new.png", url);
        verify(storageService).delete("teams/1/logo/old.png");
        verify(storageService).store(file, "teams/1/logo");
        verify(teamMapper).updateById(argThat(update ->
                teamId.equals(update.getId()) && "teams/1/logo/new.png".equals(update.getLogoUrl())
        ));
    }
}
