package com.skillstack.review.service;

import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.storage.StorageUrlResolver;
import com.skillstack.prompt.entity.Prompt;
import com.skillstack.prompt.service.PromptService;
import com.skillstack.review.entity.Review;
import com.skillstack.review.mapper.ReviewMapper;
import com.skillstack.skill.mapper.SkillMapper;
import com.skillstack.skill.mapper.SkillTagMapper;
import com.skillstack.skill.service.SkillService;
import com.skillstack.skill.service.SkillVersionFileService;
import com.skillstack.skill.service.SkillVersionService;
import com.skillstack.userskill.service.UserSkillService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReviewServicePromptTest {

    private ReviewService reviewService;
    private ReviewMapper reviewMapper;
    private SkillMapper skillMapper;
    private SkillService skillService;
    private PromptService promptService;

    @BeforeEach
    void setUp() {
        reviewMapper = mock(ReviewMapper.class);
        skillMapper = mock(SkillMapper.class);
        skillService = mock(SkillService.class);
        promptService = mock(PromptService.class);
        reviewService = new ReviewService(
                reviewMapper,
                mock(UserMapper.class),
                mock(TeamAccessGuard.class),
                skillMapper,
                mock(SkillTagMapper.class),
                mock(SkillVersionService.class),
                mock(SkillVersionFileService.class),
                skillService,
                mock(com.skillstack.notification.service.NotificationService.class),
                mock(com.skillstack.team.mapper.TeamMapper.class),
                promptService,
                mock(StorageUrlResolver.class),
                mock(UserSkillService.class)
        );
    }

    @Test
    void approvingPromptReviewDelegatesToPromptMaterialization() {
        Review review = new Review();
        review.setId(9L);
        review.setStatus("PENDING_REVIEW");
        review.setTargetType("PROMPT");
        review.setDisplayName("登录上下文");
        review.setVersion("0.1.0");
        review.setTeamId(1L);
        review.setSubmitterId(2L);
        when(reviewMapper.selectById(9L)).thenReturn(review);

        Prompt prompt = new Prompt();
        prompt.setId(33L);
        prompt.setVersion("0.1.0");
        when(promptService.approveReview(review)).thenReturn(prompt);

        reviewService.approve(9L, 7L, "ok");

        verify(promptService).approveReview(review);
        verify(skillMapper, never()).insert(any());
        verify(skillService, never()).checkSlugUniqueForReview(any(), anyLong());
        verify(reviewMapper).updateById(review);
    }
}
