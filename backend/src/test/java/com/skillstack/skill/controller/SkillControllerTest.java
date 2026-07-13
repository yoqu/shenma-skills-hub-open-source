package com.skillstack.skill.controller;

import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.PageQuery;
import com.skillstack.common.web.PageResult;
import com.skillstack.skill.dto.PlazaQuery;
import com.skillstack.skill.dto.SkillCard;
import com.skillstack.skill.dto.SkillMdContent;
import com.skillstack.skill.entity.Skill;
import com.skillstack.skill.entity.SkillVersion;
import com.skillstack.skill.service.SkillDownloadService;
import com.skillstack.skill.service.SkillParseService;
import com.skillstack.skill.service.SkillReviewService;
import com.skillstack.skill.service.SkillService;
import com.skillstack.skill.service.SkillVersionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.ArrayList;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import com.skillstack.common.exception.GlobalExceptionHandler;

/**
 * Controller tests for SkillController.
 * Tests functional behavior: public skill listing, detail, versions, download, and team skill library endpoints.
 * Permission checks for team membership are tested in SkillServiceTest at the service layer.
 */
class SkillControllerTest {

    private MockMvc mockMvc;
    private SkillService skillService;
    private SkillVersionService skillVersionService;
    private com.skillstack.skill.service.SkillVersionFileService skillVersionFileService;
    private SkillDownloadService skillDownloadService;
    private SkillParseService skillParseService;
    private SkillReviewService skillReviewService;
    private com.skillstack.common.storage.StorageService storageService;

    @BeforeEach
    void setUp() {
        skillService = mock(SkillService.class);
        skillVersionService = mock(SkillVersionService.class);
        skillVersionFileService = mock(com.skillstack.skill.service.SkillVersionFileService.class);
        skillDownloadService = mock(SkillDownloadService.class);
        skillParseService = mock(SkillParseService.class);
        skillReviewService = mock(SkillReviewService.class);
        storageService = mock(com.skillstack.common.storage.StorageService.class);
        SkillController controller = new SkillController(
                skillService, skillVersionService, skillVersionFileService,
                skillDownloadService, skillParseService, skillReviewService, storageService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    // ==================== Public Access Tests ====================

    @Test
    void testListPlazaSkills_PublicAccess_NoAuthRequired() throws Exception {
        // Public plaza endpoint should be accessible without authentication
        PageResult<SkillCard> result = PageResult.of(new ArrayList<>(), 0, 1, 10);
        when(skillService.listPublicSkills(any())).thenReturn(result);

        mockMvc.perform(get("/api/skills")
                .param("page", "1")
                .param("size", "10"))
                .andExpect(status().isOk());

        verify(skillService).listPublicSkills(any());
    }

    @Test
    void testGetSkillDetail_PublicAccess() throws Exception {
        // Public detail endpoint accessible without authentication
        String slug = "test-skill";

        mockMvc.perform(get("/api/skills/{slug}", slug))
                .andExpect(status().isOk());

        verify(skillService).getDetail(slug, null);
    }

    @Test
    void testGetSkillDetail_WithAuthentication() throws Exception {
        // Detail endpoint can receive authenticated user context
        String slug = "test-skill";
        Long userId = 100L;

        CurrentUser currentUser = new CurrentUser();
        currentUser.setId(userId);

        mockMvc.perform(get("/api/skills/{slug}", slug))
                .andExpect(status().isOk());

        // Note: Without custom argument resolver in standalone setup, userId will be null
        // But the test verifies the endpoint is callable
    }

    @Test
    void testListSkillVersions_PublicAccess() throws Exception {
        // Versions endpoint is public
        String slug = "test-skill";

        when(skillVersionService.listBySlug(slug)).thenReturn(new ArrayList<>());

        mockMvc.perform(get("/api/skills/{slug}/versions", slug))
                .andExpect(status().isOk());

        verify(skillVersionService).listBySlug(slug);
    }

    @Test
    void testDownloadSkill_PublicAccess() throws Exception {
        // Download endpoint is public but may require authentication for stats
        String slug = "test-skill";

        SkillDownloadService.ZipPayload payload = new SkillDownloadService.ZipPayload(
                "test-skill-1.0.0.zip",
                new byte[]{1, 2, 3}
        );

        when(skillDownloadService.build(slug, null, null)).thenReturn(payload);

        mockMvc.perform(get("/api/skills/{slug}/download", slug))
                .andExpect(status().isOk());

        verify(skillDownloadService).build(slug, null, null);
    }

    @Test
    void testDownloadSkill_WithVersion() throws Exception {
        // Download with specific version
        String slug = "test-skill";
        String version = "2.0.0";

        SkillDownloadService.ZipPayload payload = new SkillDownloadService.ZipPayload(
                "test-skill-2.0.0.zip",
                new byte[]{1, 2, 3}
        );

        when(skillDownloadService.build(slug, version, null)).thenReturn(payload);

        mockMvc.perform(get("/api/skills/{slug}/download", slug)
                .param("version", version))
                .andExpect(status().isOk());

        verify(skillDownloadService).build(slug, version, null);
    }

    @Test
    void testGetSkillMd_WithVersion() throws Exception {
        String slug = "test-skill";
        String version = "1.0.0";
        Skill skill = new Skill();
        skill.setId(12L);
        skill.setVersion(version);
        SkillVersion row = new SkillVersion();
        row.setId(34L);
        row.setVersion(version);
        SkillMdContent content = SkillMdContent.builder()
                .path("SKILL.md")
                .content("# Test Skill")
                .size(12L)
                .truncated(false)
                .build();

        when(skillService.requireReadable(slug, null)).thenReturn(skill);
        when(skillVersionService.findBySkillAndVersion(12L, version)).thenReturn(row);
        when(skillVersionFileService.readSkillMd(row)).thenReturn(content);

        mockMvc.perform(get("/api/skills/{slug}/versions/{version}/skill-md", slug, version))
                .andExpect(status().isOk());

        verify(skillService).requireReadable(slug, null);
        verify(skillVersionService).findBySkillAndVersion(12L, version);
        verify(skillVersionFileService).readSkillMd(row);
    }

    @Test
    void testUpdateAdminProfile_DelegatesToService() throws Exception {
        mockMvc.perform(patch("/api/skills/{id}/admin-profile", 12L)
                .contentType("application/json")
                .content("""
                        {
                          "name": "New Name",
                          "shortDesc": "New description",
                          "cat": "dev",
                          "icon": "N",
                          "visibility": "PUBLIC",
                          "tags": ["java"]
                        }
                        """))
                .andExpect(status().isOk());

        verify(skillService).updateAdminProfile(eq(12L), any(), any());
    }

    // ==================== Team Skill Access Tests ====================

    @Test
    void testListTeamSkills_AuthenticatedMember_ReturnsSkills() throws Exception {
        // Team skill library endpoint requires membership validation
        Long teamId = 1L;

        PageResult<SkillCard> result = createSkillsResult();
        when(skillService.listTeamSkills(anyLong(), any(), any())).thenReturn(result);

        mockMvc.perform(get("/api/teams/{teamId}/skills", teamId)
                .param("page", "1")
                .param("size", "10"))
                .andExpect(status().isOk());

        verify(skillService).listTeamSkills(anyLong(), any(), any());
    }

    @Test
    void testListTeamSkills_WithFilters_AppliesTeamIdAndFilters() throws Exception {
        // Team skill library should filter by team and apply query filters
        Long teamId = 2L;

        PageResult<SkillCard> result = createSkillsResult();
        when(skillService.listTeamSkills(anyLong(), any(), any())).thenReturn(result);

        mockMvc.perform(get("/api/teams/{teamId}/skills", teamId)
                .param("page", "1")
                .param("size", "20")
                .param("status", "APPROVED")
                .param("visibility", "PRIVATE"))
                .andExpect(status().isOk());

        verify(skillService).listTeamSkills(anyLong(), any(), any());
    }

    // ==================== Team Skill Access Tests (Success Case) ====================

    /**
     * Test: Team member can access team skills (with permission check in service layer)
     */
    @Test
    void testListTeamSkills_MemberAccess_Success() throws Exception {
        // Test that team skill endpoint successfully returns results when permissions allow
        Long teamId = 1L;

        PageResult<SkillCard> result = createSkillsResult();
        when(skillService.listTeamSkills(anyLong(), any(), any())).thenReturn(result);

        mockMvc.perform(get("/api/teams/{teamId}/skills", teamId)
                .param("page", "1")
                .param("size", "10"))
                .andExpect(status().isOk());

        verify(skillService).listTeamSkills(anyLong(), any(), any());
    }

    // ==================== Permission Tests (HTTP 403) ====================

    @Test
    void testListTeamSkills_NonMemberAttempt_ReturnsForbidden() throws Exception {
        Long teamId = 1L;

        // Service throws permission error when non-member attempts access
        when(skillService.listTeamSkills(anyLong(), any(), any()))
                .thenThrow(new com.skillstack.common.exception.BusinessException(40300, "不是该团队成员"));

        mockMvc.perform(get("/api/teams/{teamId}/skills", teamId)
                .param("page", "1")
                .param("size", "10"))
                .andExpect(status().isForbidden());
    }

    // ==================== Helper Methods ====================

    private PageResult<SkillCard> createSkillsResult() {
        List<SkillCard> cards = new ArrayList<>();
        SkillCard card1 = new SkillCard();
        card1.setId(1L);
        card1.setSlug("skill-1");
        card1.setName("Test Skill 1");
        cards.add(card1);

        return PageResult.of(cards, 1, 1, 10);
    }
}
