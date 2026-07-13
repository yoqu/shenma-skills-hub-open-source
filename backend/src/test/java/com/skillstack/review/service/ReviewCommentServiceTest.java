package com.skillstack.review.service;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.review.dto.ReviewCommentItem;
import com.skillstack.review.entity.Review;
import com.skillstack.review.entity.ReviewComment;
import com.skillstack.review.mapper.ReviewCommentMapper;
import com.skillstack.review.mapper.ReviewMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ReviewCommentServiceTest {

    private ReviewCommentService service;
    private ReviewMapper reviewMapper;
    private ReviewCommentMapper commentMapper;
    private TeamAccessGuard guard;
    private com.skillstack.notification.service.NotificationService notificationService;
    private ReviewService reviewService;

    @BeforeEach
    void setUp() {
        reviewMapper = mock(ReviewMapper.class);
        commentMapper = mock(ReviewCommentMapper.class);
        guard = mock(TeamAccessGuard.class);
        notificationService = mock(com.skillstack.notification.service.NotificationService.class);
        reviewService = mock(ReviewService.class);
        service = new ReviewCommentService(reviewMapper, commentMapper, guard,
                notificationService, reviewService);
    }

    private Review review(long id, long submitterId, long teamId, String status) {
        Review r = new Review();
        r.setId(id);
        r.setSubmitterId(submitterId);
        r.setTeamId(teamId);
        r.setStatus(status);
        return r;
    }

    // ===== Read =====

    @Test
    void testList_Submitter_CanRead() {
        when(reviewMapper.selectById(1L)).thenReturn(review(1L, 100L, 10L, "PENDING_REVIEW"));
        when(commentMapper.selectByReview(1L)).thenReturn(new ArrayList<>());

        List<ReviewCommentItem> items = service.list(1L, 100L);
        assertNotNull(items);
        verify(guard, never()).isWriter(any(), any());
    }

    @Test
    void testList_Writer_CanRead() {
        when(reviewMapper.selectById(1L)).thenReturn(review(1L, 100L, 10L, "PENDING_REVIEW"));
        when(guard.isWriter(10L, 50L)).thenReturn(true);
        when(commentMapper.selectByReview(1L)).thenReturn(new ArrayList<>());

        List<ReviewCommentItem> items = service.list(1L, 50L);
        assertNotNull(items);
    }

    @Test
    void testList_OtherMember_Forbidden() {
        when(reviewMapper.selectById(1L)).thenReturn(review(1L, 100L, 10L, "PENDING_REVIEW"));
        when(guard.isWriter(10L, 200L)).thenReturn(false);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.list(1L, 200L));
        assertEquals(40300, ex.getCode());
    }

    @Test
    void testList_Anonymous_Unauthorized() {
        when(reviewMapper.selectById(1L)).thenReturn(review(1L, 100L, 10L, "PENDING_REVIEW"));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.list(1L, null));
        assertEquals(40100, ex.getCode());
    }

    // ===== Create =====

    @Test
    void testCreate_AsSubmitter_KindIsMine() {
        when(reviewMapper.selectById(1L)).thenReturn(review(1L, 100L, 10L, "PENDING_REVIEW"));
        when(guard.isWriter(10L, 100L)).thenReturn(false);
        when(commentMapper.insert(any(ReviewComment.class))).thenAnswer(inv -> {
            ((ReviewComment) inv.getArgument(0)).setId(99L);
            return 1;
        });
        ReviewCommentItem stub = new ReviewCommentItem();
        stub.setId(99L);
        stub.setKind("mine");
        when(commentMapper.selectByReview(1L)).thenReturn(List.of(stub));

        ReviewCommentItem res = service.create(1L, 100L, "Hi");
        assertEquals("mine", res.getKind());
        verify(commentMapper).insert(argThat(c -> "mine".equals(c.getKind())
                && "Hi".equals(c.getBody())
                && c.getAuthorId().equals(100L)));
    }

    @Test
    void testCreate_AsWriter_KindIsReview() {
        when(reviewMapper.selectById(1L)).thenReturn(review(1L, 100L, 10L, "PENDING_REVIEW"));
        when(guard.isWriter(10L, 50L)).thenReturn(true);
        when(commentMapper.insert(any(ReviewComment.class))).thenAnswer(inv -> {
            ((ReviewComment) inv.getArgument(0)).setId(88L);
            return 1;
        });
        ReviewCommentItem stub = new ReviewCommentItem();
        stub.setId(88L);
        stub.setKind("review");
        when(commentMapper.selectByReview(1L)).thenReturn(List.of(stub));

        ReviewCommentItem res = service.create(1L, 50L, "需要修改 README");
        assertEquals("review", res.getKind());
    }

    @Test
    void testCreate_OnApproved_Throws() {
        when(reviewMapper.selectById(1L)).thenReturn(review(1L, 100L, 10L, "APPROVED"));
        when(guard.isWriter(10L, 100L)).thenReturn(false);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.create(1L, 100L, "hi"));
        assertEquals(40900, ex.getCode());
        verify(commentMapper, never()).insert(any());
    }

    @Test
    void testCreate_NotMemberNotSubmitter_Forbidden() {
        when(reviewMapper.selectById(1L)).thenReturn(review(1L, 100L, 10L, "PENDING_REVIEW"));
        when(guard.isWriter(10L, 999L)).thenReturn(false);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.create(1L, 999L, "hi"));
        assertEquals(40300, ex.getCode());
    }

    @Test
    void testCreate_EmptyBody_BadRequest() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.create(1L, 100L, "   "));
        assertEquals(40000, ex.getCode());
        verify(commentMapper, never()).insert(any());
    }

    @Test
    void testCreate_NullUser_Unauthorized() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.create(1L, null, "hi"));
        assertEquals(40100, ex.getCode());
    }

    @Test
    void writer_comment_notifies_submitter() {
        long reviewId = 10L, submitterId = 100L, teamId = 7L, writerId = 50L;
        Review r = review(reviewId, submitterId, teamId, "PENDING_REVIEW");
        when(reviewMapper.selectById(reviewId)).thenReturn(r);
        when(guard.isWriter(teamId, writerId)).thenReturn(true);

        com.skillstack.review.dto.ReviewCommentItem stub = new com.skillstack.review.dto.ReviewCommentItem();
        stub.setId(999L);
        java.util.List<com.skillstack.review.dto.ReviewCommentItem> list = new java.util.ArrayList<>();
        list.add(stub);
        when(commentMapper.selectByReview(reviewId)).thenReturn(list);

        doAnswer(inv -> {
            ReviewComment arg = inv.getArgument(0);
            arg.setId(999L);
            return 1;
        }).when(commentMapper).insert(any(ReviewComment.class));

        com.skillstack.review.dto.ReviewCommentItem.Author author = new com.skillstack.review.dto.ReviewCommentItem.Author();
        author.setId(writerId);
        stub.setAuthor(author);

        service.create(reviewId, writerId, "please add tests");

        verify(notificationService).notify(
                eq(com.skillstack.notification.service.NotificationType.REVIEW_COMMENT),
                eq(submitterId), eq(teamId), eq(writerId),
                eq("审核人评论了你的 Skill"), eq("please add tests"),
                eq("/team/mine"), eq("review_comment"), any());
        verify(reviewService, never()).notifyReviewCommentToWriters(any(), any(), any());
    }

    @Test
    void submitter_comment_notifies_team_writers() {
        long reviewId = 11L, submitterId = 101L, teamId = 8L;
        Review r = review(reviewId, submitterId, teamId, "PENDING_REVIEW");
        when(reviewMapper.selectById(reviewId)).thenReturn(r);
        when(guard.isWriter(teamId, submitterId)).thenReturn(false);

        com.skillstack.review.dto.ReviewCommentItem stub = new com.skillstack.review.dto.ReviewCommentItem();
        stub.setId(1000L);
        com.skillstack.review.dto.ReviewCommentItem.Author author = new com.skillstack.review.dto.ReviewCommentItem.Author();
        author.setId(submitterId);
        stub.setAuthor(author);
        java.util.List<com.skillstack.review.dto.ReviewCommentItem> list = new java.util.ArrayList<>();
        list.add(stub);
        when(commentMapper.selectByReview(reviewId)).thenReturn(list);
        doAnswer(inv -> {
            ReviewComment arg = inv.getArgument(0);
            arg.setId(1000L);
            return 1;
        }).when(commentMapper).insert(any(ReviewComment.class));

        service.create(reviewId, submitterId, "已补充测试");

        verify(reviewService).notifyReviewCommentToWriters(eq(r), eq(submitterId), eq("已补充测试"));
        verify(notificationService, never()).notify(
                any(com.skillstack.notification.service.NotificationType.class),
                any(), any(), any(), any(), any(), any(), any(), any());
    }
}
