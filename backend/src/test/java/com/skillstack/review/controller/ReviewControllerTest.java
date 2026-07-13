package com.skillstack.review.controller;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.web.PageResult;
import com.skillstack.review.dto.ReviewDetail;
import com.skillstack.review.dto.ReviewListItem;
import com.skillstack.review.service.ReviewCommentService;
import com.skillstack.review.service.ReviewService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.ArrayList;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import com.skillstack.common.exception.GlobalExceptionHandler;

/**
 * Controller tests for ReviewController.
 * Tests functional behavior: queue, detail, approve, reject, and request-changes endpoints.
 * Permission checks are tested in ReviewServicePermissionTest at the service layer.
 */
class ReviewControllerTest {

    private MockMvc mockMvc;
    private ReviewService reviewService;
    private ReviewCommentService reviewCommentService;

    @BeforeEach
    void setUp() {
        reviewService = mock(ReviewService.class, withSettings().serializable());
        reviewCommentService = mock(ReviewCommentService.class);
        com.skillstack.review.service.ReviewFileService reviewFileService =
                mock(com.skillstack.review.service.ReviewFileService.class);
        TeamAccessGuard guard = mock(TeamAccessGuard.class);
        ReviewController controller = new ReviewController(reviewService, reviewCommentService, reviewFileService, guard);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    // ==================== Functional Tests ====================

    @Test
    void testQueueReviews_SuccessfulQuery() throws Exception {
        // Queue endpoint successfully returns list of reviews
        Long teamId = 1L;

        PageResult<ReviewListItem> emptyResult = PageResult.of(new ArrayList<>(), 0, 1, 10);
        when(reviewService.queue(eq(teamId), any(), any(), anyLong(), anyLong()))
                .thenReturn(emptyResult);

        mockMvc.perform(get("/api/teams/{teamId}/reviews", teamId)
                .param("status", "PENDING")
                .param("page", "1")
                .param("size", "10"))
                .andExpect(status().isOk());

        verify(reviewService).queue(eq(teamId), any(), any(), anyLong(), anyLong());
    }

    @Test
    void testDetailReview_UserCanRetrieve() throws Exception {
        // Detail endpoint is read-only, any authenticated user can retrieve
        Long reviewId = 1L;

        ReviewDetail detail = new ReviewDetail();
        detail.setId("r-1001");
        detail.setSlug("test-skill");
        detail.setStatus("PENDING_REVIEW");

        when(reviewService.detail(reviewId)).thenReturn(detail);

        mockMvc.perform(get("/api/reviews/{id}", reviewId))
                .andExpect(status().isOk());

        verify(reviewService).detail(reviewId);
    }


    // ==================== Success Cases ====================

    @Test
    void testApproveReview_Succeeds() throws Exception {
        Long reviewId = 1L;

        // Service succeeds when admin approves
        doNothing().when(reviewService).approve(eq(reviewId), any(), any());

        mockMvc.perform(post("/api/reviews/{id}/approve", reviewId)
                .contentType("application/json")
                .content("{\"comment\": \"Looks good\"}"))
                .andExpect(status().isOk());

        verify(reviewService).approve(eq(reviewId), any(), any());
    }

    @Test
    void testRejectReview_Succeeds() throws Exception {
        Long reviewId = 1L;

        // Service succeeds when admin rejects
        doNothing().when(reviewService).reject(eq(reviewId), any(), any());

        mockMvc.perform(post("/api/reviews/{id}/reject", reviewId)
                .contentType("application/json")
                .content("{\"reason\": \"Does not meet quality standards\"}"))
                .andExpect(status().isOk());

        verify(reviewService).reject(eq(reviewId), any(), any());
    }

    @Test
    void testRequestChanges_Succeeds() throws Exception {
        Long reviewId = 1L;

        // Service succeeds when admin requests changes
        doNothing().when(reviewService).requestChanges(eq(reviewId), any(), any());

        mockMvc.perform(post("/api/reviews/{id}/request-changes", reviewId)
                .contentType("application/json")
                .content("{\"reason\": \"Please update documentation\"}"))
                .andExpect(status().isOk());

        verify(reviewService).requestChanges(eq(reviewId), any(), any());
    }

    // ==================== Permission Tests (HTTP 403) ====================

    @Test
    void testApproveReview_NonAdminAttempt_ReturnsForbidden() throws Exception {
        Long reviewId = 1L;

        // Service throws permission error when non-admin attempts approve
        doThrow(new com.skillstack.common.exception.BusinessException(40300, "权限不足"))
                .when(reviewService).approve(anyLong(), any(), anyString());

        mockMvc.perform(post("/api/reviews/{id}/approve", reviewId)
                .contentType("application/json")
                .content("{\"comment\": \"Looks good\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void testRejectReview_NonAdminAttempt_ReturnsForbidden() throws Exception {
        Long reviewId = 1L;

        // Service throws permission error when non-admin attempts reject
        doThrow(new com.skillstack.common.exception.BusinessException(40300, "权限不足"))
                .when(reviewService).reject(anyLong(), any(), anyString());

        mockMvc.perform(post("/api/reviews/{id}/reject", reviewId)
                .contentType("application/json")
                .content("{\"reason\": \"Does not meet quality standards\"}"))
                .andExpect(status().isForbidden());
    }

    // ==================== Withdraw / Resubmit (REV-005) ====================

    @Test
    void testWithdraw_Succeeds() throws Exception {
        Long reviewId = 1L;
        doNothing().when(reviewService).requireSubmitter(eq(reviewId), any());
        doNothing().when(reviewService).withdraw(reviewId);

        mockMvc.perform(post("/api/reviews/{id}/withdraw", reviewId))
                .andExpect(status().isOk());

        verify(reviewService).requireSubmitter(eq(reviewId), any());
        verify(reviewService).withdraw(reviewId);
    }

    @Test
    void testWithdraw_NotSubmitter_ReturnsForbidden() throws Exception {
        Long reviewId = 1L;
        doThrow(new BusinessException(40300, "只能操作自己提交的审核"))
                .when(reviewService).requireSubmitter(anyLong(), any());

        mockMvc.perform(post("/api/reviews/{id}/withdraw", reviewId))
                .andExpect(status().isForbidden());

        verify(reviewService, never()).withdraw(anyLong());
    }

    @Test
    void testResubmit_Succeeds() throws Exception {
        Long reviewId = 1L;
        doNothing().when(reviewService).requireSubmitter(eq(reviewId), any());
        doNothing().when(reviewService).resubmit(eq(reviewId), any());

        mockMvc.perform(post("/api/reviews/{id}/resubmit", reviewId))
                .andExpect(status().isOk());

        verify(reviewService).resubmit(eq(reviewId), any());
    }

    @Test
    void testResubmit_NotSubmitter_ReturnsForbidden() throws Exception {
        Long reviewId = 1L;
        doThrow(new BusinessException(40300, "只能操作自己提交的审核"))
                .when(reviewService).requireSubmitter(anyLong(), any());

        mockMvc.perform(post("/api/reviews/{id}/resubmit", reviewId))
                .andExpect(status().isForbidden());

        verify(reviewService, never()).resubmit(anyLong(), any());
    }
}
