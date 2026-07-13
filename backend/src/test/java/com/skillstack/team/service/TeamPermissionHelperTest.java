package com.skillstack.team.service;

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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Permission boundary tests for team member verification.
 * Tests requireTeamMember() and requireTeamAdmin() permission checks.
 */
class TeamPermissionHelperTest {

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

    /**
     * Test: requireTeamMember() with non-member should throw 403 Forbidden
     */
    @Test
    void testRequireTeamMember_NonMember_Throws403Forbidden() {
        // Arrange: User is not a team member
        Long teamId = 1L;
        Long userId = 100L;

        Team team = new Team();
        team.setId(teamId);
        team.setName("Test Team");
        when(teamMapper.selectById(teamId)).thenReturn(team);
        when(teamMemberMapper.selectOne(any())).thenReturn(null);

        // Act & Assert: Verify that requireMembership throws BusinessException with forbidden code
        BusinessException ex = assertThrows(BusinessException.class, () -> {
            teamService.requireMembership(teamId, userId);
        });

        // Assert: Verify the error is a permission denial (403-equivalent)
        assertTrue(ex.getMessage().contains("T_FORBIDDEN"),
            "Error message should indicate forbidden access");
        assertTrue(ex.getMessage().contains("不是该团队成员"),
            "Error message should indicate not a team member");
    }

    /**
     * Test: requireTeamAdmin() with regular member should throw 403 Forbidden
     */
    @Test
    void testRequireTeamAdmin_RegularMember_Throws403Forbidden() {
        // Arrange: User is a team member but not admin
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

        // Act & Assert: Verify that requireWriter (which enforces admin/owner) throws BusinessException
        BusinessException ex = assertThrows(BusinessException.class, () -> {
            teamService.requireWriter(teamId, userId);
        });

        // Assert: Verify the error is a permission denial (403-equivalent)
        assertTrue(ex.getMessage().contains("T_FORBIDDEN"),
            "Error message should indicate forbidden access");
        assertTrue(ex.getMessage().contains("ADMIN"),
            "Error message should indicate ADMIN role is required");
    }

    /**
     * Test: requireTeamAdmin() with admin should pass without exception
     */
    @Test
    void testRequireTeamAdmin_WithAdminRole_Passes() {
        // Arrange: User is a team admin
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

        // Act: Call requireWriter (which enforces admin/owner)
        TeamMember result = teamService.requireWriter(teamId, userId);

        // Assert: Verify that the method returns the admin member without throwing
        assertNotNull(result, "requireWriter should return the team member");
        assertEquals("ADMIN", result.getRole(), "Result should indicate ADMIN role");
        assertEquals(userId, result.getUserId(), "Result should contain correct user ID");
    }

    /**
     * Test: requireTeamAdmin() with owner should also pass without exception
     */
    @Test
    void testRequireTeamAdmin_WithOwnerRole_Passes() {
        // Arrange: User is a team owner (also has admin permissions)
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

        // Act: Call requireWriter (which enforces admin/owner)
        TeamMember result = teamService.requireWriter(teamId, userId);

        // Assert: Verify that the method returns the owner member without throwing
        assertNotNull(result, "requireWriter should return the team member");
        assertEquals("OWNER", result.getRole(), "Result should indicate OWNER role");
        assertEquals(userId, result.getUserId(), "Result should contain correct user ID");
    }

    /**
     * Test: requireTeamMember() with valid member should pass
     */
    @Test
    void testRequireTeamMember_WithValidMember_Passes() {
        // Arrange: User is a team member
        Long teamId = 1L;
        Long userId = 100L;

        TeamMember member = new TeamMember();
        member.setTeamId(teamId);
        member.setUserId(userId);
        member.setRole("MEMBER");
        when(teamMemberMapper.selectOne(any())).thenReturn(member);

        // Act: Call requireMembership
        TeamMember result = teamService.requireMembership(teamId, userId);

        // Assert: Verify that the method returns the member without throwing
        assertNotNull(result, "requireMembership should return the team member");
        assertEquals("MEMBER", result.getRole(), "Result should indicate MEMBER role");
        assertEquals(userId, result.getUserId(), "Result should contain correct user ID");
    }
}
