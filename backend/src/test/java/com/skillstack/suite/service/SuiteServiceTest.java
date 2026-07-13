package com.skillstack.suite.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.storage.StorageUrlResolver;
import com.skillstack.common.web.PageQuery;
import com.skillstack.notification.service.NotificationService;
import com.skillstack.suite.dto.CreateSuiteReq;
import com.skillstack.suite.dto.SuiteDetail;
import com.skillstack.suite.dto.UpdateSuiteItemsReq;
import com.skillstack.suite.entity.Suite;
import com.skillstack.suite.entity.SuiteItem;
import com.skillstack.suite.mapper.SuiteItemMapper;
import com.skillstack.suite.mapper.SuiteMapper;
import com.skillstack.team.mapper.TeamMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SuiteServiceTest {

    private SuiteMapper suiteMapper;
    private SuiteItemMapper suiteItemMapper;
    private JdbcTemplate jdbc;
    private TeamAccessGuard guard;
    private SuiteService service;

    @BeforeEach
    void setUp() {
        suiteMapper = mock(SuiteMapper.class);
        suiteItemMapper = mock(SuiteItemMapper.class);
        jdbc = mock(JdbcTemplate.class);
        guard = mock(TeamAccessGuard.class);
        NotificationService notificationService = mock(NotificationService.class);
        TeamMapper teamMapper = mock(TeamMapper.class);
        StorageUrlResolver storageUrlResolver = mock(StorageUrlResolver.class);
        service = new SuiteService(suiteMapper, suiteItemMapper, jdbc, guard, notificationService, teamMapper, storageUrlResolver);
    }

    @Test
    void listByTeam_rejectsAnonymousReadWhenPublicHomeDisabled() {
        when(jdbc.queryForMap(anyString(), eq(10L))).thenReturn(Map.of("public_home", 0));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.listByTeam(10L, null, new PageQuery(), null));

        assertEquals(40400, ex.getCode());
        verify(suiteMapper, never()).selectPage(any(), any());
    }

    @Test
    void getByTeamAndSlug_rejectsAnonymousReadWhenPublicHomeDisabled() {
        when(jdbc.queryForMap(anyString(), eq(10L))).thenReturn(Map.of("public_home", 0));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.getByTeamAndSlug(10L, "daily", null));

        assertEquals(40400, ex.getCode());
        verify(suiteMapper, never()).selectOne(any());
    }

    @Test
    void listByTeam_allowsMemberReadWhenPublicHomeDisabled() {
        when(suiteMapper.selectPage(any(), any())).thenAnswer(inv -> inv.getArgument(0, Page.class));

        assertDoesNotThrow(() -> service.listByTeam(10L, null, new PageQuery(), 20L));
        verify(guard).requireMember(10L, 20L);
    }

    @Test
    void createPersistsMixedSkillAndPromptItems() {
        when(suiteMapper.exists(any())).thenReturn(false);
        when(suiteMapper.insert(any(Suite.class))).thenAnswer(inv -> {
            Suite suite = inv.getArgument(0);
            suite.setId(99L);
            return 1;
        });
        when(suiteItemMapper.insert(any(SuiteItem.class))).thenReturn(1);
        when(jdbc.queryForMap("SELECT id, team_id FROM skills WHERE id = ? AND deleted = 0", 1L))
                .thenReturn(Map.of("id", 1L, "team_id", 10L));
        when(jdbc.queryForMap("SELECT id, team_id FROM prompts WHERE id = ? AND deleted = 0", 2L))
                .thenReturn(Map.of("id", 2L, "team_id", 10L));
        when(jdbc.queryForMap("SELECT slug, name FROM teams WHERE id = ? AND deleted = 0", 10L))
                .thenReturn(Map.of("slug", "ludou-fe", "name", "麓豆前端组"));
        when(jdbc.query(anyString(), any(org.springframework.jdbc.core.RowMapper.class), eq(99L)))
                .thenReturn(java.util.List.of());

        CreateSuiteReq req = new CreateSuiteReq();
        req.setSlug("mixed-assets");
        req.setName("混合资产套件");
        req.setDescription("Skill + Prompt");
        req.setVisibility("TEAM_PRIVATE");

        UpdateSuiteItemsReq.Item skill = new UpdateSuiteItemsReq.Item();
        skill.setType("SKILL");
        skill.setSkillId(1L);
        skill.setPosition(1);

        UpdateSuiteItemsReq.Item prompt = new UpdateSuiteItemsReq.Item();
        prompt.setType("PROMPT");
        prompt.setItemId(2L);
        prompt.setPosition(2);

        req.setItems(java.util.List.of(skill, prompt));

        SuiteDetail detail = service.create(10L, req, 20L);

        assertEquals(99L, detail.getId());
        verify(suiteItemMapper, atLeastOnce()).insert(org.mockito.ArgumentMatchers.argThat(item ->
                "SKILL".equals(item.getItemType())
                        && Long.valueOf(1L).equals(item.getItemId())
                        && Long.valueOf(1L).equals(item.getSkillId())
                        && Integer.valueOf(1).equals(item.getPosition())
        ));
        verify(suiteItemMapper, atLeastOnce()).insert(org.mockito.ArgumentMatchers.argThat(item ->
                "PROMPT".equals(item.getItemType())
                        && Long.valueOf(2L).equals(item.getItemId())
                        && item.getSkillId() == null
                        && Integer.valueOf(2).equals(item.getPosition())
        ));
    }
}
