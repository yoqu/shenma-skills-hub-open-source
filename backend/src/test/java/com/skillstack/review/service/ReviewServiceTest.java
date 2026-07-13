package com.skillstack.review.service;

import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.storage.StorageUrlResolver;
import com.skillstack.review.entity.Review;
import com.skillstack.review.mapper.ReviewMapper;
import com.skillstack.skill.mapper.SkillMapper;
import com.skillstack.skill.mapper.SkillTagMapper;
import com.skillstack.skill.service.SkillService;
import com.skillstack.skill.service.SkillVersionService;
import com.skillstack.userskill.service.UserSkillService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.*;

/**
 * Consolidated service layer tests for ReviewService.
 * Includes functional behavior and permission boundary tests.
 */
class ReviewServiceTest {

    private ReviewService reviewService;
    private ReviewMapper reviewMapper;
    private UserMapper userMapper;
    private TeamAccessGuard guard;
    private SkillMapper skillMapper;
    private SkillTagMapper skillTagMapper;
    private SkillVersionService skillVersionService;
    private com.skillstack.skill.service.SkillVersionFileService skillVersionFileService;
    private SkillService skillService;
    private com.skillstack.notification.service.NotificationService notificationService;
    private com.skillstack.team.mapper.TeamMapper teamMapper;
    private com.skillstack.prompt.service.PromptService promptService;
    private UserSkillService userSkillService;

    @BeforeEach
    void setUp() {
        reviewMapper = mock(ReviewMapper.class);
        userMapper = mock(UserMapper.class);
        guard = mock(TeamAccessGuard.class);
        skillMapper = mock(SkillMapper.class);
        skillTagMapper = mock(SkillTagMapper.class);
        skillVersionService = mock(SkillVersionService.class);
        skillVersionFileService = mock(com.skillstack.skill.service.SkillVersionFileService.class);
        skillService = mock(SkillService.class);
        notificationService = mock(com.skillstack.notification.service.NotificationService.class);
        teamMapper = mock(com.skillstack.team.mapper.TeamMapper.class);
        promptService = mock(com.skillstack.prompt.service.PromptService.class);
        userSkillService = mock(UserSkillService.class);
        reviewService = new ReviewService(reviewMapper, userMapper, guard,
                skillMapper, skillTagMapper, skillVersionService, skillVersionFileService, skillService,
                notificationService, teamMapper, promptService, mock(StorageUrlResolver.class), userSkillService);
    }

    // ==================== Functional Tests ====================

    @Test
    void testApproveReview_CreateKind_MaterializesSkill() {
        // Arrange: kind=CREATE 的待审核行，approve 时应物化 skills 行。
        Long reviewId = 1L;
        Long reviewerId = 100L;
        String comment = "Approved";

        Review review = new Review();
        review.setId(reviewId);
        review.setStatus("PENDING_REVIEW");
        review.setKind("CREATE");
        review.setSkillSlug("test-skill");
        review.setSkillName("Skill · test-skill");
        review.setShortDesc("desc");
        review.setCatCode("dev");
        review.setIcon("T");
        review.setVersion("0.1.0");
        review.setVisibility("PUBLIC");
        review.setSubmitterId(50L);
        review.setTeamId(10L);
        review.setSafety("pass");
        review.setEvalScore(0);
        review.setLangsJson("[]");
        review.setTagsJson("[]");
        review.setFilesCount(3);

        when(reviewMapper.selectById(reviewId)).thenReturn(review);
        when(reviewMapper.updateById(any(Review.class))).thenReturn(1);

        reviewService.approve(reviewId, reviewerId, comment);

        verify(skillService).checkSlugUniqueForReview("test-skill", reviewId);
        // uk_skills_slug 不含 deleted，approve 必须在 INSERT 前清理同 slug 的 soft-deleted 占位
        verify(skillService).purgeStaleSlug("test-skill");
        verify(skillMapper).insert(any());
        // skillId 由 MyBatis Plus 在 insert 后回填，单测中 mock 不会真正赋值，因此用 anyLong / nullable。
        verify(skillVersionService).insertInitialVersion(nullable(Long.class), eq("0.1.0"), eq(3),
                eq("pass"), eq(0), nullable(String.class));
        verify(reviewMapper).updateById(any(Review.class));
        // kind=CREATE 不应回写 skills.status
        verify(reviewMapper, never()).updateSkillStatus(anyLong(), anyString(), anyBoolean());
    }

    @Test
    void testApproveReview_AlreadyApproved_ThrowsException() {
        // Arrange: Review is already approved
        Long reviewId = 1L;
        Long reviewerId = 100L;

        Review review = new Review();
        review.setId(reviewId);
        review.setStatus("APPROVED");

        when(reviewMapper.selectById(reviewId)).thenReturn(review);

        // Act & Assert
        BusinessException ex = assertThrows(BusinessException.class, () -> {
            reviewService.approve(reviewId, reviewerId, "comment");
        });

        assertTrue(ex.getMessage().contains("已处理"));
        verify(reviewMapper, never()).updateById(any());
    }

    @Test
    void testApproveReview_AlreadyRejected_ThrowsException() {
        // Arrange: Review is already rejected
        Long reviewId = 1L;
        Long reviewerId = 100L;

        Review review = new Review();
        review.setId(reviewId);
        review.setStatus("REJECTED");

        when(reviewMapper.selectById(reviewId)).thenReturn(review);

        // Act & Assert
        BusinessException ex = assertThrows(BusinessException.class, () -> {
            reviewService.approve(reviewId, reviewerId, "comment");
        });

        assertTrue(ex.getMessage().contains("已处理"));
        verify(reviewMapper, never()).updateById(any());
    }

    @Test
    void testRejectReview_WithReason_UpdatesStatus() {
        // Arrange: Valid pending review with rejection reason
        Long reviewId = 1L;
        Long reviewerId = 100L;
        String reason = "Quality issues";

        Review review = new Review();
        review.setId(reviewId);
        review.setStatus("PENDING_REVIEW");
        review.setKind("CREATE");
        review.setSkillSlug("test-skill");

        when(reviewMapper.selectById(reviewId)).thenReturn(review);
        when(reviewMapper.updateById(any(Review.class))).thenReturn(1);

        // Act
        reviewService.reject(reviewId, reviewerId, reason);

        // Assert
        verify(reviewMapper).updateById(any(Review.class));
        // kind=CREATE：没有 skills 行可回写
        verify(reviewMapper, never()).updateSkillStatus(anyLong(), anyString(), anyBoolean());
    }

    @Test
    void testRejectReview_WithoutReason_ThrowsException() {
        // Arrange: Rejection without reason
        Long reviewId = 1L;
        Long reviewerId = 100L;

        Review review = new Review();
        review.setId(reviewId);
        review.setStatus("PENDING_REVIEW");

        when(reviewMapper.selectById(reviewId)).thenReturn(review);

        // Act & Assert
        BusinessException ex = assertThrows(BusinessException.class, () -> {
            reviewService.reject(reviewId, reviewerId, "");
        });

        assertTrue(ex.getMessage().contains("不能为空"));
        verify(reviewMapper, never()).updateById(any());
    }

    @Test
    void testRejectReview_AlreadyApproved_ThrowsException() {
        // Arrange: Cannot reject an approved review
        Long reviewId = 1L;
        Long reviewerId = 100L;

        Review review = new Review();
        review.setId(reviewId);
        review.setStatus("APPROVED");

        when(reviewMapper.selectById(reviewId)).thenReturn(review);

        // Act & Assert
        BusinessException ex = assertThrows(BusinessException.class, () -> {
            reviewService.reject(reviewId, reviewerId, "Some reason");
        });

        assertTrue(ex.getMessage().contains("已处理"));
        verify(reviewMapper, never()).updateById(any());
    }

    @Test
    void testRequestChanges_WithReason_UpdatesReviewReason() {
        // Arrange: Request changes on pending review
        Long reviewId = 1L;
        Long reviewerId = 100L;
        String reason = "Please revise documentation";

        Review review = new Review();
        review.setId(reviewId);
        review.setStatus("PENDING_REVIEW");

        when(reviewMapper.selectById(reviewId)).thenReturn(review);
        when(reviewMapper.updateById(any(Review.class))).thenReturn(1);

        // Act
        reviewService.requestChanges(reviewId, reviewerId, reason);

        // Assert
        verify(reviewMapper).updateById(any(Review.class));
    }

    @Test
    void testRequestChanges_WithoutReason_ThrowsException() {
        // Arrange: Cannot request changes without reason
        Long reviewId = 1L;
        Long reviewerId = 100L;

        Review review = new Review();
        review.setId(reviewId);
        review.setStatus("PENDING_REVIEW");

        when(reviewMapper.selectById(reviewId)).thenReturn(review);

        // Act & Assert
        BusinessException ex = assertThrows(BusinessException.class, () -> {
            reviewService.requestChanges(reviewId, reviewerId, null);
        });

        assertTrue(ex.getMessage().contains("不能为空"));
        verify(reviewMapper, never()).updateById(any());
    }

    @Test
    void testRequestChanges_OnApprovedReview_ThrowsException() {
        // Arrange: Cannot request changes on already processed review
        Long reviewId = 1L;
        Long reviewerId = 100L;

        Review review = new Review();
        review.setId(reviewId);
        review.setStatus("APPROVED");

        when(reviewMapper.selectById(reviewId)).thenReturn(review);

        // Act & Assert
        BusinessException ex = assertThrows(BusinessException.class, () -> {
            reviewService.requestChanges(reviewId, reviewerId, "Some reason");
        });

        assertTrue(ex.getMessage().contains("已处理"));
        verify(reviewMapper, never()).updateById(any());
    }

    // ==================== Approve with version bump (SKILL-VER-001) ====================

    @Test
    void testApprove_NewVersion_SyncsSkillVersionAndWritesHistory() {
        Long reviewId = 1L;
        Review review = new Review();
        review.setId(reviewId);
        review.setStatus("PENDING_REVIEW");
        review.setKind("VERSION_BUMP");
        review.setSkillId(10L);
        review.setVersion("1.1.0");
        review.setChangelog("新增功能 X");
        review.setFilesCount(3);
        review.setSafety("pass");
        review.setEvalScore(0);

        when(reviewMapper.selectById(reviewId)).thenReturn(review);
        when(reviewMapper.updateById(any(Review.class))).thenReturn(1);
        when(reviewMapper.findSkillVersion(10L)).thenReturn("1.0.0");
        when(reviewMapper.updateSkillVersion(10L, "1.1.0")).thenReturn(1);
        when(reviewMapper.insertSkillVersion(eq(10L), eq("1.1.0"), eq("新增功能 X"),
                isNull(), eq(3), eq("pass"), eq(0))).thenReturn(1);

        reviewService.approve(reviewId, 50L, null);

        // VERSION_BUMP 不再回写 skills.status（保留 APPROVED）
        verify(reviewMapper, never()).updateSkillStatus(anyLong(), anyString(), anyBoolean());
        verify(reviewMapper).updateSkillVersion(10L, "1.1.0");
        verify(reviewMapper).insertSkillVersion(10L, "1.1.0", "新增功能 X", null, 3, "pass", 0);
    }

    @Test
    void testApprove_SameVersion_DoesNotWriteSkillVersionHistory() {
        Long reviewId = 1L;
        Review review = new Review();
        review.setId(reviewId);
        review.setStatus("PENDING_REVIEW");
        review.setKind("VERSION_BUMP");
        review.setSkillId(10L);
        review.setVersion("1.0.0");

        when(reviewMapper.selectById(reviewId)).thenReturn(review);
        when(reviewMapper.updateById(any(Review.class))).thenReturn(1);
        when(reviewMapper.findSkillVersion(10L)).thenReturn("1.0.0");

        reviewService.approve(reviewId, 50L, null);

        verify(reviewMapper, never()).updateSkillVersion(anyLong(), anyString());
        verify(reviewMapper, never()).insertSkillVersion(anyLong(), anyString(),
                anyString(), nullable(String.class), anyInt(), anyString(), anyInt());
    }

    // ==================== Withdraw / Resubmit (REV-005) ====================

    @Test
    void testWithdraw_PendingReview_TransitionsToWithdrawn() {
        Long reviewId = 1L;
        Review review = new Review();
        review.setId(reviewId);
        review.setStatus("PENDING_REVIEW");
        review.setKind("CREATE");
        review.setSkillSlug("test-skill");

        when(reviewMapper.selectById(reviewId)).thenReturn(review);
        when(reviewMapper.updateById(any(Review.class))).thenReturn(1);

        reviewService.withdraw(reviewId);

        assertEquals("WITHDRAWN", review.getStatus());
        assertNotNull(review.getDecidedAt());
        // 不再回写 skills.status
        verify(reviewMapper, never()).updateSkillStatus(anyLong(), anyString(), anyBoolean());
    }

    @Test
    void testWithdraw_OnApprovedReview_ThrowsException() {
        Long reviewId = 1L;
        Review review = new Review();
        review.setId(reviewId);
        review.setStatus("APPROVED");

        when(reviewMapper.selectById(reviewId)).thenReturn(review);

        BusinessException ex = assertThrows(BusinessException.class, () -> {
            reviewService.withdraw(reviewId);
        });

        assertTrue(ex.getMessage().contains("撤回"));
        verify(reviewMapper, never()).updateById(any());
    }

    @Test
    void testRequireSubmitter_NotSubmitter_ThrowsForbidden() {
        Long reviewId = 1L;
        Review review = new Review();
        review.setId(reviewId);
        review.setSubmitterId(100L);

        when(reviewMapper.selectById(reviewId)).thenReturn(review);

        BusinessException ex = assertThrows(BusinessException.class, () -> {
            reviewService.requireSubmitter(reviewId, 999L);
        });

        assertEquals(40300, ex.getCode());
    }

    @Test
    void testRequireSubmitter_SameUser_NoException() {
        Long reviewId = 1L;
        Review review = new Review();
        review.setId(reviewId);
        review.setSubmitterId(100L);

        when(reviewMapper.selectById(reviewId)).thenReturn(review);

        assertDoesNotThrow(() -> reviewService.requireSubmitter(reviewId, 100L));
    }

    @Test
    void testResubmit_ChangesRequested_TransitionsToPending() {
        Long reviewId = 1L;
        Review review = new Review();
        review.setId(reviewId);
        review.setStatus("CHANGES_REQUESTED");
        review.setKind("CREATE");
        review.setSkillSlug("test-skill");
        review.setReason("旧的修改建议");
        review.setReviewerId(50L);

        when(reviewMapper.selectById(reviewId)).thenReturn(review);
        when(reviewMapper.updateById(any(Review.class))).thenReturn(1);

        reviewService.resubmit(reviewId);

        assertEquals("PENDING_REVIEW", review.getStatus());
        verify(skillService).checkSlugUniqueForReview("test-skill", reviewId);
        verify(reviewMapper).clearDecision(reviewId);
        verify(reviewMapper, never()).updateSkillStatus(anyLong(), anyString(), anyBoolean());
    }

    @Test
    void testResubmit_OnPendingReview_ThrowsException() {
        Long reviewId = 1L;
        Review review = new Review();
        review.setId(reviewId);
        review.setStatus("PENDING_REVIEW");

        when(reviewMapper.selectById(reviewId)).thenReturn(review);

        BusinessException ex = assertThrows(BusinessException.class, () -> {
            reviewService.resubmit(reviewId);
        });

        assertTrue(ex.getMessage().contains("不可重新提交"));
        verify(reviewMapper, never()).updateById(any());
    }

    @Test
    void testDetailReview_NonExistent_ThrowsException() {
        // Arrange: Review doesn't exist
        Long reviewId = 999L;

        when(reviewMapper.selectById(reviewId)).thenReturn(null);

        // Act & Assert
        BusinessException ex = assertThrows(BusinessException.class, () -> {
            reviewService.detail(reviewId);
        });

        assertTrue(ex.getMessage().contains("不存在"));
    }

    // ==================== Notification Tests ====================

    @Test
    void approve_emits_REVIEW_APPROVED_to_submitter() {
        Long reviewId = 1L;
        Long reviewerId = 100L;
        Review r = new Review();
        r.setId(reviewId); r.setStatus("PENDING_REVIEW"); r.setKind("VERSION_BUMP");
        r.setSubmitterId(50L); r.setTeamId(10L); r.setSkillName("Skill · demo");
        r.setVersion("1.0.0");
        when(reviewMapper.selectById(reviewId)).thenReturn(r);

        reviewService.approve(reviewId, reviewerId, "ok");

        verify(notificationService).notify(
                eq(com.skillstack.notification.service.NotificationType.REVIEW_APPROVED),
                eq(50L), eq(10L), eq(reviewerId),
                anyString(), anyString(), eq("/team/mine"),
                eq("review"), eq(reviewId));
    }

    @Test
    void reject_emits_REVIEW_REJECTED_to_submitter() {
        Long reviewId = 2L;
        Long reviewerId = 101L;
        Review r = new Review();
        r.setId(reviewId); r.setStatus("PENDING_REVIEW");
        r.setSubmitterId(51L); r.setTeamId(11L); r.setSkillName("Skill · demo");
        when(reviewMapper.selectById(reviewId)).thenReturn(r);

        reviewService.reject(reviewId, reviewerId, "missing tests");

        verify(notificationService).notify(
                eq(com.skillstack.notification.service.NotificationType.REVIEW_REJECTED),
                eq(51L), eq(11L), eq(reviewerId),
                anyString(), eq("missing tests"), eq("/team/mine"),
                eq("review"), eq(reviewId));
    }

    @Test
    void requestChanges_emits_REVIEW_CHANGES_REQUESTED_to_submitter() {
        Long reviewId = 3L;
        Long reviewerId = 102L;
        Review r = new Review();
        r.setId(reviewId); r.setStatus("PENDING_REVIEW");
        r.setSubmitterId(52L); r.setTeamId(12L); r.setSkillName("Skill · demo");
        when(reviewMapper.selectById(reviewId)).thenReturn(r);

        reviewService.requestChanges(reviewId, reviewerId, "rename file");

        verify(notificationService).notify(
                eq(com.skillstack.notification.service.NotificationType.REVIEW_CHANGES_REQUESTED),
                eq(52L), eq(12L), eq(reviewerId),
                anyString(), eq("rename file"), eq("/team/mine"),
                eq("review"), eq(reviewId));
    }
}
