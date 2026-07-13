package com.skillstack.asset.service;

import com.skillstack.asset.entity.AssetReview;
import com.skillstack.asset.mapper.AssetReviewMapper;
import com.skillstack.asset.mapper.AssetReviewReplyMapper;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.prompt.entity.Prompt;
import com.skillstack.prompt.mapper.PromptMapper;
import com.skillstack.skill.dto.SkillReviewSummary;
import com.skillstack.skill.dto.SubmitSkillReviewReq;
import com.skillstack.skill.mapper.SkillMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Collections;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AssetReviewServiceTest {

    private AssetReviewService service;
    private AssetReviewMapper reviewMapper;
    private PromptMapper promptMapper;
    private SkillMapper skillMapper;

    @BeforeEach
    void setUp() {
        reviewMapper = mock(AssetReviewMapper.class);
        promptMapper = mock(PromptMapper.class);
        skillMapper = mock(SkillMapper.class);
        service = new AssetReviewService(
                reviewMapper,
                mock(AssetReviewReplyMapper.class),
                skillMapper,
                promptMapper,
                mock(UserMapper.class)
        );
    }

    @Test
    void submitPromptReviewWritesPromptTargetAndRecomputesPromptScoreOnly() {
        Prompt p = new Prompt();
        p.setId(7L);
        p.setAuthorId(99L);
        when(promptMapper.selectById(7L)).thenReturn(p);
        when(reviewMapper.selectOne(any())).thenReturn(null);
        when(reviewMapper.selectList(any())).thenReturn(Collections.emptyList());

        SubmitSkillReviewReq req = new SubmitSkillReviewReq();
        req.setRating(5);
        req.setBody("very useful");
        req.setVersion("1.0.0");
        SkillReviewSummary summary = service.submit("PROMPT", 7L, 3L, req);

        ArgumentCaptor<AssetReview> cap = ArgumentCaptor.forClass(AssetReview.class);
        verify(reviewMapper).insert(cap.capture());
        assertThat(cap.getValue().getTargetType()).isEqualTo("PROMPT");
        assertThat(cap.getValue().getTargetId()).isEqualTo(7L);
        verify(promptMapper).recomputeScore(7L);
        org.mockito.Mockito.verify(skillMapper, org.mockito.Mockito.never()).recomputeScore(org.mockito.Mockito.anyLong());
        assertThat(summary.getTotal()).isZero();
    }
}
