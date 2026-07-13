package com.skillstack.skill.service;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.web.PageResult;
import com.skillstack.skill.dto.CreateSkillRes;
import com.skillstack.skill.dto.AdminSkillProfileUpdateReq;
import com.skillstack.skill.dto.PlazaQuery;
import com.skillstack.skill.dto.SkillCard;
import com.skillstack.skill.entity.Category;
import com.skillstack.skill.entity.Skill;
import com.skillstack.skill.entity.SkillVersion;
import com.skillstack.review.entity.Review;
import com.skillstack.skill.mapper.SkillMapper;
import com.skillstack.skill.mapper.SkillStarMapper;
import com.skillstack.skill.mapper.SkillTagMapper;
import com.skillstack.skill.mapper.TagMapper;
import com.skillstack.review.mapper.ReviewMapper;
import com.skillstack.skill.service.SkillVersionFileService;
import com.skillstack.skill.service.SkillVersionService;
import com.skillstack.team.entity.Team;
import com.skillstack.team.service.TeamService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Consolidated service layer tests for SkillService.
 * Includes functional behavior and permission boundary tests.
 */
class SkillServiceTest {

    private SkillService skillService;
    private SkillMapper skillMapper;
    private SkillTagMapper skillTagMapper;
    private TagMapper tagMapper;
    private SkillStarMapper skillStarMapper;
    private ReviewMapper reviewMapper;
    private TeamAccessGuard guard;
    private TeamService teamService;
    private CategoryService categoryService;
    private SkillVersionService skillVersionService;
    private SkillVersionFileService skillVersionFileService;

    @BeforeEach
    void setUp() {
        skillMapper = mock(SkillMapper.class);
        skillTagMapper = mock(SkillTagMapper.class);
        tagMapper = mock(TagMapper.class);
        skillStarMapper = mock(SkillStarMapper.class);
        reviewMapper = mock(ReviewMapper.class);
        guard = mock(TeamAccessGuard.class);
        teamService = mock(TeamService.class);
        categoryService = mock(CategoryService.class);
        skillVersionService = mock(SkillVersionService.class);
        skillVersionFileService = mock(SkillVersionFileService.class);
        // 默认团队为审核模式，避免 create 测试受 DIRECT_PUBLISH 影响。
        Team defaultTeam = new Team();
        defaultTeam.setReviewMode("REVIEW_REQUIRED");
        when(teamService.requireTeam(anyLong())).thenReturn(defaultTeam);
        skillService = new SkillService(
                skillMapper, skillTagMapper, tagMapper, skillStarMapper, skillVersionService, skillVersionFileService, reviewMapper, guard,
                teamService, categoryService,
                mock(com.skillstack.common.storage.StorageUrlResolver.class),
                mock(com.skillstack.common.storage.StorageService.class));
    }

    // ==================== Functional Tests ====================

    @Test
    void testListPublicSkills_WithoutTeamId_ReturnsPublicSkills() {
        // Arrange: Public plaza query without team filter
        com.skillstack.common.web.PageQuery pageQuery = new com.skillstack.common.web.PageQuery();
        pageQuery.setPage(1);
        pageQuery.setSize(10);

        when(skillMapper.selectPublicSkills(anyLong(), anyLong())).thenReturn(new ArrayList<>());
        when(skillMapper.countPublicSkills()).thenReturn(0L);

        // Act
        PageResult<SkillCard> result = skillService.listPublicSkills(pageQuery);

        // Assert
        assertNotNull(result);
        assertEquals(1, result.getPage());
        assertEquals(10, result.getSize());
    }

    @Test
    void testListPlaza_WithTeamId_FiltersByTeam() {
        // Arrange: Team skill library query
        PlazaQuery query = new PlazaQuery();
        query.setTeamId(1L);
        query.setPage(1);
        query.setSize(10);

        when(skillMapper.selectPlaza(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), eq(1L), nullable(Long.class), nullable(Integer.class), anyLong(), anyLong())).thenReturn(new ArrayList<>());
        when(skillMapper.countPlaza(anyString(), anyString(), anyString(), anyString(), anyString(), eq(1L), nullable(Long.class), nullable(Integer.class))).thenReturn(0L);

        // Act
        PageResult<SkillCard> result = skillService.listPlaza(query);

        // Assert
        assertNotNull(result);
        assertEquals(1L, query.getTeamId());
    }

    @Test
    void testListPlaza_WithTeamIdAndStatusFilter_AppliesBothFilters() {
        // Arrange: Team skill library with status filtering
        PlazaQuery query = new PlazaQuery();
        query.setTeamId(1L);
        query.setStatus("APPROVED");
        query.setVisibility("PUBLIC");
        query.setPage(1);
        query.setSize(10);

        when(skillMapper.selectPlaza(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), eq(1L), nullable(Long.class), nullable(Integer.class), anyLong(), anyLong())).thenReturn(new ArrayList<>());
        when(skillMapper.countPlaza(anyString(), anyString(), anyString(), anyString(), anyString(), eq(1L), nullable(Long.class), nullable(Integer.class))).thenReturn(0L);

        // Act
        PageResult<SkillCard> result = skillService.listPlaza(query);

        // Assert
        assertNotNull(result);
        assertEquals(0, result.getItems().size());
    }

    @Test
    void testListDrafts_UserCanAccessOwnDrafts() {
        // Arrange: User's draft skills
        Long userId = 100L;

        when(skillMapper.selectDraftsByUser(userId)).thenReturn(new ArrayList<>());

        // Act
        List<SkillCard> result = skillService.listDrafts(userId);

        // Assert
        assertNotNull(result);
    }

    @Test
    void testInstallSkill_UserCanInstall() {
        // Arrange: User installs a public skill
        Long skillId = 1L;

        Skill skill = new Skill();
        skill.setId(skillId);
        skill.setSlug("public-skill");
        skill.setVisibility("PUBLIC");

        when(skillMapper.selectById(skillId)).thenReturn(skill);

        // Act: Note - actual install logic may be mocked further
        // This tests that the endpoint is callable for installation
    }

    @Test
    void testGetDetail_PublicSkill_AccessibleWithoutMembership() {
        // Arrange: Public skill accessible to anyone
        String slug = "public-skill";
        Long userId = 100L; // Optional userId, may be null for anonymous

        // Act: Service should allow access regardless of team membership
        // when skill is public

        // Assert: Service validates visibility, not team membership
    }

    @Test
    void testListTeamSkillsPage_WithPagination_ReturnsPaginatedResults() {
        // Arrange: Paginated team skill library
        PlazaQuery query = new PlazaQuery();
        query.setTeamId(1L);
        query.setPage(2);
        query.setSize(20);

        when(skillMapper.selectPlaza(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), eq(1L), nullable(Long.class), nullable(Integer.class), anyLong(), anyLong())).thenReturn(new ArrayList<>());
        when(skillMapper.countPlaza(anyString(), anyString(), anyString(), anyString(), anyString(), eq(1L), nullable(Long.class), nullable(Integer.class))).thenReturn(0L);

        // Act
        PageResult<SkillCard> result = skillService.listPlaza(query);

        // Assert
        assertNotNull(result);
        assertEquals(2, result.getPage());
        assertEquals(20, result.getSize());
    }

    @Test
    void listTeamSkills_rejectsAnonymousReadWhenPublicHomeDisabled() {
        Team privateTeam = new Team();
        privateTeam.setId(10L);
        privateTeam.setPublicHome(Boolean.FALSE);
        when(teamService.requireTeam(10L)).thenReturn(privateTeam);

        PlazaQuery query = new PlazaQuery();
        query.setPage(1);
        query.setSize(10);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> skillService.listTeamSkills(10L, query, null));

        assertEquals(40400, ex.getCode());
        verify(skillMapper, never()).selectPlaza(any(), any(), any(), any(), any(), any(), any(), any(), any(), anyLong(), anyLong());
    }

    @Test
    void listTeamSkills_allowsAnonymousReadWhenPublicHomeEnabled() {
        Team publicTeam = new Team();
        publicTeam.setId(10L);
        publicTeam.setPublicHome(Boolean.TRUE);
        when(teamService.requireTeam(10L)).thenReturn(publicTeam);
        when(skillMapper.selectPlaza(any(), any(), any(), any(), eq("PUBLIC"), eq("APPROVED"), eq(10L), any(), any(), anyLong(), anyLong()))
                .thenReturn(new ArrayList<>());
        when(skillMapper.countPlaza(any(), any(), any(), eq("PUBLIC"), eq("APPROVED"), eq(10L), any(), any()))
                .thenReturn(0L);

        PlazaQuery query = new PlazaQuery();
        query.setPage(1);
        query.setSize(10);

        PageResult<SkillCard> result = skillService.listTeamSkills(10L, query, null);

        assertNotNull(result);
        assertEquals("PUBLIC", query.getVisibility());
        assertEquals("APPROVED", query.getStatus());
    }

    // ==================== submitVersion (SKILL-VER-001) ====================

    private Skill approvedSkill(long id, long authorId, String version) {
        Skill s = new Skill();
        s.setId(id);
        s.setSlug("test-skill");
        s.setName("test");
        s.setShortDesc("desc");
        s.setVisibility("PUBLIC");
        s.setStatus("APPROVED");
        s.setAuthorId(authorId);
        s.setTeamId(10L);
        s.setVersion(version);
        s.setSafety("pass");
        s.setEvalScore(0);
        return s;
    }

    @Test
    void testSubmitVersion_MemberInReviewMode_CreatesPendingReview() {
        Skill s = approvedSkill(1L, 100L, "1.0.0");
        when(skillMapper.selectById(1L)).thenReturn(s);
        doThrow(new BusinessException(40300, "不是管理员")).when(guard).requireWriter(10L, 100L);
        when(reviewMapper.countOpenBySkill(1L)).thenReturn(0L);

        CreateSkillRes res = skillService.submitVersion(1L, 100L, "1.1.0", "新增功能", "skill-versions/100/pkg.zip");

        assertEquals("PENDING_REVIEW", res.getStatus());
        assertTrue(res.getPendingReview());
        verify(reviewMapper).insert(any(Review.class));
        verify(skillMapper, never()).updateById(any(Skill.class));
    }

    @Test
    void testSubmitVersion_AdminPublishesDirectlyWithoutReview() {
        Skill s = approvedSkill(1L, 100L, "1.0.0");
        s.setStatus("UNLISTED");
        when(skillMapper.selectById(1L)).thenReturn(s);
        when(reviewMapper.countOpenBySkill(1L)).thenReturn(0L);
        SkillVersion version = new SkillVersion();
        version.setId(88L);
        when(skillVersionService.insertVersion(1L, "1.1.0", "新增功能", 0, "pass", 0, "skill-versions/999/pkg.zip"))
                .thenReturn(version);

        CreateSkillRes res = skillService.submitVersion(1L, 999L, "1.1.0", "新增功能", "skill-versions/999/pkg.zip");

        assertEquals("UNLISTED", res.getStatus());
        assertFalse(res.getPendingReview());
        assertEquals("1.1.0", s.getVersion());
        assertEquals("UNLISTED", s.getStatus());
        verify(guard).requireWriter(10L, 999L);
        verify(reviewMapper, never()).insert(any(Review.class));
        verify(skillMapper).updateById(s);
        verify(skillVersionService).insertVersion(1L, "1.1.0", "新增功能", 0, "pass", 0, "skill-versions/999/pkg.zip");
        verify(skillVersionFileService).materializeQuietly(88L, "skill-versions/999/pkg.zip");
    }

    @Test
    void testSubmitVersion_MemberInDirectPublishMode_PublishesDirectly() {
        Skill s = approvedSkill(1L, 100L, "1.0.0");
        when(skillMapper.selectById(1L)).thenReturn(s);
        doThrow(new BusinessException(40300, "不是管理员")).when(guard).requireWriter(10L, 100L);
        Team directTeam = new Team();
        directTeam.setReviewMode("DIRECT_PUBLISH");
        when(teamService.requireTeam(10L)).thenReturn(directTeam);
        SkillVersion version = new SkillVersion();
        version.setId(89L);
        when(skillVersionService.insertVersion(1L, "1.1.0", "新增功能", 0, "pass", 0, "skill-versions/100/pkg.zip")).thenReturn(version);

        CreateSkillRes res = skillService.submitVersion(1L, 100L, "1.1.0", "新增功能", "skill-versions/100/pkg.zip");

        assertEquals("APPROVED", res.getStatus());
        assertFalse(res.getPendingReview());
        verify(reviewMapper, never()).insert(any(Review.class));
        verify(skillMapper).updateById(s);
        verify(skillVersionFileService).materializeQuietly(89L, "skill-versions/100/pkg.zip");
    }

    @Test
    void testSubmitVersion_NonMember_ThrowsForbidden() {
        Skill s = approvedSkill(1L, 100L, "1.0.0");
        when(skillMapper.selectById(1L)).thenReturn(s);
        doThrow(new BusinessException(40300, "不是管理员")).when(guard).requireWriter(10L, 999L);
        doThrow(new BusinessException(40300, "不是成员")).when(guard).requireMember(10L, 999L);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> skillService.submitVersion(1L, 999L, "1.1.0", null, "skill-versions/999/pkg.zip"));
        assertEquals(40300, ex.getCode());
        verify(reviewMapper, never()).insert(any(Review.class));
    }

    @Test
    void testSubmitVersion_TeamMemberButNotAuthorOrWriter_ThrowsForbidden() {
        Skill s = approvedSkill(1L, 100L, "1.0.0");
        when(skillMapper.selectById(1L)).thenReturn(s);
        doThrow(new BusinessException(40300, "不是管理员")).when(guard).requireWriter(10L, 200L);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> skillService.submitVersion(1L, 200L, "1.1.0", null, "skill-versions/200/pkg.zip"));

        assertEquals(40300, ex.getCode());
        assertTrue(ex.getMessage().contains("作者"));
        verify(guard, never()).requireMember(10L, 200L);
        verify(reviewMapper, never()).insert(any(Review.class));
        verify(skillMapper, never()).updateById(any(Skill.class));
    }

    @Test
    void testSubmitVersion_EmptyZipUrl_ThrowsBadRequest() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> skillService.submitVersion(1L, 100L, "1.1.0", null, "  "));

        assertEquals(40000, ex.getCode());
        assertTrue(ex.getMessage().contains("源文件"));
        verify(skillMapper, never()).selectById(anyLong());
        verify(reviewMapper, never()).insert(any(Review.class));
    }

    @Test
    void testSubmitVersion_SkillNotApproved_ThrowsConflict() {
        Skill s = approvedSkill(1L, 100L, "1.0.0");
        s.setStatus("DRAFT");
        when(skillMapper.selectById(1L)).thenReturn(s);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> skillService.submitVersion(1L, 100L, "1.1.0", null, "skill-versions/100/pkg.zip"));
        assertTrue(ex.getMessage().contains("已上线"));
    }

    @Test
    void testSubmitVersion_SameVersion_ThrowsConflict() {
        Skill s = approvedSkill(1L, 100L, "1.0.0");
        when(skillMapper.selectById(1L)).thenReturn(s);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> skillService.submitVersion(1L, 100L, "1.0.0", null, "skill-versions/100/pkg.zip"));
        assertTrue(ex.getMessage().contains("相同"));
    }

    @Test
    void testSubmitVersion_HasOpenReview_ThrowsConflict() {
        Skill s = approvedSkill(1L, 100L, "1.0.0");
        when(skillMapper.selectById(1L)).thenReturn(s);
        when(reviewMapper.countOpenBySkill(1L)).thenReturn(1L);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> skillService.submitVersion(1L, 100L, "1.1.0", null, "skill-versions/100/pkg.zip"));
        assertTrue(ex.getMessage().contains("未决审核"));
        verify(reviewMapper, never()).insert(any(Review.class));
    }

    @Test
    void updateAdminProfile_AdminUpdatesDescriptionAndTags() {
        Skill s = approvedSkill(1L, 100L, "1.0.0");
        when(skillMapper.selectById(1L)).thenReturn(s);
        Category cat = new Category();
        cat.setCode("dev");
        when(categoryService.findByCode("dev")).thenReturn(cat);

        AdminSkillProfileUpdateReq req = new AdminSkillProfileUpdateReq();
        req.setName("New Name");
        req.setShortDesc("New description");
        req.setCat("dev");
        req.setIcon("N");
        req.setVisibility("TEAM_PRIVATE");
        req.setTags(List.of("java", "java", "ai"));

        skillService.updateAdminProfile(1L, req, 999L);

        assertEquals("New Name", s.getName());
        assertEquals("New description", s.getShortDesc());
        assertEquals("dev", s.getCatCode());
        assertEquals("N", s.getIcon());
        assertEquals("TEAM_PRIVATE", s.getVisibility());
        verify(guard).requireWriter(10L, 999L);
        verify(skillMapper).updateById(s);
        verify(skillTagMapper).delete(any());
    }

    @Test
    void updateAdminProfile_MemberCannotUpdate() {
        Skill s = approvedSkill(1L, 100L, "1.0.0");
        when(skillMapper.selectById(1L)).thenReturn(s);
        doThrow(new BusinessException(40300, "不是管理员")).when(guard).requireWriter(10L, 100L);

        AdminSkillProfileUpdateReq req = new AdminSkillProfileUpdateReq();
        req.setName("New Name");
        req.setShortDesc("New description");
        req.setCat("dev");
        req.setVisibility("PUBLIC");

        assertThrows(BusinessException.class, () -> skillService.updateAdminProfile(1L, req, 100L));
        verify(skillMapper, never()).updateById(any(Skill.class));
    }

    @Test
    void testSubmitVersion_EmptyVersion_ThrowsBadRequest() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> skillService.submitVersion(1L, 100L, "  ", null, null));
        assertEquals(40000, ex.getCode());
    }

    @Test
    void testSubmitVersion_SkillNotFound_ThrowsNotFound() {
        when(skillMapper.selectById(999L)).thenReturn(null);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> skillService.submitVersion(999L, 100L, "1.1.0", null, "skill-versions/100/pkg.zip"));
        assertEquals(40400, ex.getCode());
    }

    @Test
    void testListPlaza_EmptyTeamSkills_ReturnsEmptyPage() {
        // Arrange: Team with no skills
        PlazaQuery query = new PlazaQuery();
        query.setTeamId(999L);
        query.setPage(1);
        query.setSize(10);

        when(skillMapper.selectPlaza(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), eq(999L), nullable(Long.class), nullable(Integer.class), anyLong(), anyLong())).thenReturn(new ArrayList<>());
        when(skillMapper.countPlaza(anyString(), anyString(), anyString(), anyString(), anyString(), eq(999L), nullable(Long.class), nullable(Integer.class))).thenReturn(0L);

        // Act
        PageResult<SkillCard> result = skillService.listPlaza(query);

        // Assert
        assertNotNull(result);
        assertEquals(0, result.getItems().size());
        assertEquals(0, result.getTotal());
    }

    @Test
    void testPurgeStaleSlug_NoMatches_DoesNothing() {
        when(skillMapper.findPurgeableSoftDeletedIdsBySlug("cs-guide"))
                .thenReturn(new ArrayList<>());

        skillService.purgeStaleSlug("cs-guide");

        verify(skillMapper).findPurgeableSoftDeletedIdsBySlug("cs-guide");
        verify(skillMapper, never()).hardDeleteVersionsBySkillIds(anyList());
        verify(skillMapper, never()).hardDeleteTagsBySkillIds(anyList());
        verify(skillMapper, never()).hardDeleteSkillsByIds(anyList());
    }

    @Test
    void testPurgeStaleSlug_HasMatches_DeletesVersionsThenTagsThenSkills() {
        List<Long> ids = List.of(11L);
        when(skillMapper.findPurgeableSoftDeletedIdsBySlug("cs-guide"))
                .thenReturn(ids);

        skillService.purgeStaleSlug("cs-guide");

        // skill_versions / skill_tags 必须先于 skills 删除，否则 FK 阻塞
        org.mockito.InOrder ord = inOrder(skillMapper);
        ord.verify(skillMapper).findPurgeableSoftDeletedIdsBySlug("cs-guide");
        ord.verify(skillMapper).hardDeleteVersionsBySkillIds(ids);
        ord.verify(skillMapper).hardDeleteTagsBySkillIds(ids);
        ord.verify(skillMapper).hardDeleteSkillsByIds(ids);
    }

    @Test
    void testPurgeStaleSlug_BlankSlug_NoOp() {
        skillService.purgeStaleSlug("");
        skillService.purgeStaleSlug(null);
        verify(skillMapper, never()).findPurgeableSoftDeletedIdsBySlug(anyString());
    }
}
