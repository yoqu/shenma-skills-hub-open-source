package com.skillstack.userskill.service;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.skill.entity.Skill;
import com.skillstack.skill.entity.SkillVersion;
import com.skillstack.skill.service.SkillService;
import com.skillstack.skill.service.SkillVersionService;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.service.TeamService;
import com.skillstack.userskill.dto.UserSkillImportReq;
import com.skillstack.userskill.dto.UserSkillItem;
import com.skillstack.userskill.dto.UserSkillSubscribeReq;
import com.skillstack.userskill.entity.UserSkill;
import com.skillstack.userskill.mapper.UserSkillMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static java.util.Map.entry;

class UserSkillServiceTest {

    private UserSkillService userSkillService;
    private UserSkillMapper userSkillMapper;
    private SkillService skillService;
    private SkillVersionService skillVersionService;
    private TeamService teamService;

    @BeforeEach
    void setUp() {
        userSkillMapper = mock(UserSkillMapper.class);
        skillService = mock(SkillService.class);
        skillVersionService = mock(SkillVersionService.class);
        teamService = mock(TeamService.class);
        userSkillService = new UserSkillService(userSkillMapper, skillService, skillVersionService, teamService);
    }

    @Test
    void subscribeApprovedPublicSkillUsesCurrentVersionZipUrl() {
        Skill skill = approvedPublicSkill();
        SkillVersion version = new SkillVersion();
        version.setZipUrl("skills/demo-skill/1.2.3.zip");
        version.setFilesCount(7);

        when(skillService.findById(10L)).thenReturn(skill);
        when(skillVersionService.findBySkillAndVersion(10L, "1.2.3")).thenReturn(version);
        when(userSkillMapper.selectOneIncludeDeletedBySkillId(1L, 10L)).thenReturn(null);
        doAnswer(invocation -> {
            UserSkill row = invocation.getArgument(0);
            row.setId(100L);
            return 1;
        }).when(userSkillMapper).insert(any(UserSkill.class));
        when(userSkillMapper.selectMineWithSkill(1L)).thenReturn(List.of(Map.ofEntries(
                entry("id", 100L),
                entry("source", "PUBLIC"),
                entry("skill_id", 10L),
                entry("review_id", 0L),
                entry("slug", "demo-skill"),
                entry("name", "Demo Skill"),
                entry("short_desc", "demo"),
                entry("cat_code", "dev"),
                entry("icon", "sparkles"),
                entry("version", "1.2.3"),
                entry("zip_url", "skills/demo-skill/1.2.3.zip"),
                entry("files_count", 7),
                entry("safety", "pass"),
                entry("eval_score", 88),
                entry("langs", "[\"Java\"]"),
                entry("public_version", "1.2.3"),
                entry("public_status", "APPROVED"),
                entry("public_visibility", "PUBLIC"),
                entry("public_deleted", 0),
                entry("public_installs", 3),
                entry("public_stars", 2),
                entry("author_id", 9L),
                entry("author_name", "Root Admin"),
                entry("author_handle", "root")
        )));

        UserSkillItem item = userSkillService.subscribe(1L, subscribeReq(10L));

        assertEquals("skills/demo-skill/1.2.3.zip", item.getZipUrl());
        assertEquals(7, item.getFilesCount());
        assertEquals("PUBLIC", item.getSource());
        assertEquals("Root Admin", item.getAuthor().getName());
    }

    @Test
    void subscribeTeamSkillAsTeamSourceWhenUserIsTeamMember() {
        Skill skill = approvedPublicSkill();
        skill.setTeamId(88L);
        SkillVersion version = new SkillVersion();
        version.setZipUrl("skills/demo-skill/1.2.3.zip");
        version.setFilesCount(7);

        when(skillService.findById(10L)).thenReturn(skill);
        when(teamService.requireMembership(88L, 1L)).thenReturn(new TeamMember());
        when(skillVersionService.findBySkillAndVersion(10L, "1.2.3")).thenReturn(version);
        when(userSkillMapper.selectOneIncludeDeletedBySkillId(1L, 10L)).thenReturn(null);
        doAnswer(invocation -> {
            UserSkill row = invocation.getArgument(0);
            row.setId(100L);
            return 1;
        }).when(userSkillMapper).insert(any(UserSkill.class));
        when(userSkillMapper.selectMineWithSkill(1L)).thenReturn(List.of(Map.ofEntries(
                entry("id", 100L),
                entry("source", "TEAM"),
                entry("skill_id", 10L),
                entry("review_id", 0L),
                entry("slug", "demo-skill"),
                entry("name", "Demo Skill"),
                entry("short_desc", "demo"),
                entry("cat_code", "dev"),
                entry("icon", "sparkles"),
                entry("version", "1.2.3"),
                entry("zip_url", "skills/demo-skill/1.2.3.zip"),
                entry("files_count", 7),
                entry("safety", "pass"),
                entry("eval_score", 88),
                entry("langs", "[\"Java\"]"),
                entry("public_version", "1.2.3"),
                entry("public_status", "APPROVED"),
                entry("public_visibility", "PUBLIC"),
                entry("public_deleted", 0),
                entry("public_installs", 3),
                entry("public_stars", 2)
        )));

        UserSkillItem item = userSkillService.subscribe(1L, subscribeReq(10L));

        assertEquals("TEAM", item.getSource());
    }

    @Test
    void subscribeRejectsSkillWithoutDownloadZip() {
        Skill skill = approvedPublicSkill();

        when(skillService.findById(10L)).thenReturn(skill);
        when(skillVersionService.findBySkillAndVersion(10L, "1.2.3")).thenReturn(null);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> userSkillService.subscribe(1L, subscribeReq(10L)));

        assertEquals(40900, ex.getCode());
        assertTrue(ex.getMessage().contains("zip"));
        verify(userSkillMapper, never()).insert(any(UserSkill.class));
    }

    @Test
    void subscribeRejectsNonPublicOrUnapprovedSkill() {
        Skill skill = approvedPublicSkill();
        skill.setStatus("PENDING");

        when(skillService.findById(10L)).thenReturn(skill);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> userSkillService.subscribe(1L, subscribeReq(10L)));

        assertEquals(40900, ex.getCode());
        verify(skillVersionService, never()).findBySkillAndVersion(any(), any());
        verify(userSkillMapper, never()).insert(any(UserSkill.class));
    }

    @Test
    void importPersonalUpdatesExistingPersonalSkillAndKeepsPublicRelation() {
        UserSkill existing = new UserSkill();
        existing.setId(20L);
        existing.setUserId(1L);
        existing.setSource("PERSONAL");
        existing.setSkillId(30L);
        existing.setReviewId(40L);
        existing.setDeleted(0);

        when(userSkillMapper.selectOneIncludeDeletedBySlug(1L, "PERSONAL", "local-skill")).thenReturn(existing);
        when(userSkillMapper.selectMineWithSkill(1L)).thenReturn(List.of(Map.ofEntries(
                entry("id", 20L),
                entry("source", "PERSONAL"),
                entry("skill_id", 30L),
                entry("review_id", 40L),
                entry("slug", "local-skill"),
                entry("name", "Local Skill"),
                entry("short_desc", ""),
                entry("cat_code", ""),
                entry("icon", ""),
                entry("version", "0.2.0"),
                entry("zip_url", "personal/local-skill.zip"),
                entry("files_count", 1),
                entry("safety", "pass"),
                entry("eval_score", 0),
                entry("langs", "[]"),
                entry("created_at", "2026-05-30 08:00:00"),
                entry("updated_at", "2026-06-01 12:00:00"),
                entry("author_id", 1L),
                entry("author_name", "Alice"),
                entry("author_handle", "alice")
        )));

        UserSkillItem item = userSkillService.importPersonal(1L, importReq());

        assertEquals(30L, item.getSkillId());
        assertEquals(40L, item.getReviewId());
        assertEquals("Alice", item.getAuthor().getName());
        assertEquals("2026-06-01 12:00:00", item.getUpdatedAt());
        verify(userSkillMapper).updateById(existing);
        verify(userSkillMapper, never()).insert(any(UserSkill.class));
    }

    @Test
    void deleteMineRejectsOtherUsersSkill() {
        UserSkill row = new UserSkill();
        row.setId(50L);
        row.setUserId(2L);
        row.setDeleted(0);

        when(userSkillMapper.selectById(50L)).thenReturn(row);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> userSkillService.deleteMine(1L, 50L));

        assertEquals(40400, ex.getCode());
        verify(userSkillMapper, never()).deleteById(any(Serializable.class));
    }

    private UserSkillSubscribeReq subscribeReq(Long skillId) {
        UserSkillSubscribeReq req = new UserSkillSubscribeReq();
        req.setSkillId(skillId);
        return req;
    }

    private UserSkillImportReq importReq() {
        UserSkillImportReq req = new UserSkillImportReq();
        req.setName("Local Skill");
        req.setSlug("local-skill");
        req.setVersion("0.2.0");
        req.setZipUrl("personal/local-skill.zip");
        req.setFilesCount(1);
        return req;
    }

    private Skill approvedPublicSkill() {
        Skill skill = new Skill();
        skill.setId(10L);
        skill.setSlug("demo-skill");
        skill.setName("Demo Skill");
        skill.setShortDesc("demo");
        skill.setCatCode("dev");
        skill.setIcon("sparkles");
        skill.setVersion("1.2.3");
        skill.setStatus("APPROVED");
        skill.setVisibility("PUBLIC");
        skill.setSafety("pass");
        skill.setEvalScore(88);
        skill.setLangs("[\"Java\"]");
        return skill;
    }
}
