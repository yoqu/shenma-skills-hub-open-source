package com.skillstack.team.service;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.web.PageQuery;
import com.skillstack.team.entity.Team;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.team.mapper.TeamMemberMapper;
import com.skillstack.skill.mapper.SkillMapper;
import com.skillstack.token.service.PersonalAccessTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TeamMemberServiceTest {

    private TeamMapper teamMapper;
    private TeamMemberMapper teamMemberMapper;
    private TeamMemberService service;

    @BeforeEach
    void setUp() {
        teamMapper = mock(TeamMapper.class);
        teamMemberMapper = mock(TeamMemberMapper.class);
        TeamService teamService = mock(TeamService.class);
        PersonalAccessTokenService patService = mock(PersonalAccessTokenService.class);
        com.skillstack.common.security.PermissionService permissionService =
                mock(com.skillstack.common.security.PermissionService.class);
        when(permissionService.isSuperAdmin(any(Long.class))).thenReturn(false);
        SkillMapper skillMapper = mock(SkillMapper.class);
        service = new TeamMemberService(teamMapper, teamMemberMapper, teamService, patService, permissionService, skillMapper);

        when(teamService.requireTeam(1L)).thenAnswer(inv -> privateTeam());
        when(teamService.requireTeam(2L)).thenAnswer(inv -> publicTeam());
        when(teamMapper.selectMembers(any(), any(), any(), any(Long.class), any(Long.class)))
                .thenReturn(List.of());
        when(teamMapper.countMembers(any(), any(), any())).thenReturn(0L);
    }

    @Test
    void page_rejectsAnonymousReadWhenPublicHomeDisabled() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.page(1L, null, null, new PageQuery(), null));
        assertEquals(40400, ex.getCode());
        verify(teamMapper, never()).selectMembers(any(), any(), any(), any(Long.class), any(Long.class));
    }

    @Test
    void page_allowsAnonymousReadWhenPublicHomeEnabled() {
        assertDoesNotThrow(() -> service.page(2L, null, null, new PageQuery(), null));
        verify(teamMapper).selectMembers(eq(2L), any(), any(), eq(0L), eq(20L));
    }

    @Test
    void page_allowsMemberReadWhenPublicHomeDisabled() {
        TeamMember member = new TeamMember();
        member.setTeamId(1L);
        member.setUserId(10L);
        member.setRole("MEMBER");
        when(teamMemberMapper.selectOne(any())).thenReturn(member);

        assertDoesNotThrow(() -> service.page(1L, null, null, new PageQuery(), 10L));
        verify(teamMapper).selectMembers(eq(1L), any(), any(), eq(0L), eq(20L));
    }

    private Team privateTeam() {
        Team team = new Team();
        team.setId(1L);
        team.setPublicHome(Boolean.FALSE);
        return team;
    }

    private Team publicTeam() {
        Team team = new Team();
        team.setId(2L);
        team.setPublicHome(Boolean.TRUE);
        return team;
    }
}
