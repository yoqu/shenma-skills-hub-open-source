package com.skillstack.skill.service;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.storage.StorageUrlResolver;
import com.skillstack.skill.dto.SkillReviewItem;
import com.skillstack.skill.dto.SkillReviewSummary;
import com.skillstack.skill.dto.SubmitSkillReviewReplyReq;
import com.skillstack.skill.dto.SubmitSkillReviewReq;
import com.skillstack.skill.entity.Skill;
import com.skillstack.skill.entity.SkillReview;
import com.skillstack.skill.entity.SkillReviewReply;
import com.skillstack.skill.mapper.SkillMapper;
import com.skillstack.skill.mapper.SkillReviewMapper;
import com.skillstack.skill.mapper.SkillReviewReplyMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class SkillReviewServiceTest {

    private SkillReviewService service;
    private SkillReviewMapper reviewMapper;
    private SkillReviewReplyMapper replyMapper;
    private SkillMapper skillMapper;
    private SkillService skillService;
    private UserMapper userMapper;

    @BeforeEach
    void setUp() {
        reviewMapper = mock(SkillReviewMapper.class);
        replyMapper = mock(SkillReviewReplyMapper.class);
        skillMapper = mock(SkillMapper.class);
        skillService = mock(SkillService.class);
        userMapper = mock(UserMapper.class);
        service = new SkillReviewService(reviewMapper, replyMapper, skillMapper, skillService, userMapper,
                mock(StorageUrlResolver.class));
    }

    private Skill skill(long id, long authorId) {
        Skill s = new Skill();
        s.setId(id);
        s.setAuthorId(authorId);
        s.setSlug("s-" + id);
        return s;
    }

    private User user(long id, String handle, String name) {
        User u = new User();
        u.setId(id);
        u.setHandle(handle);
        u.setName(name);
        return u;
    }

    private SubmitSkillReviewReq req(int rating, String body, String version) {
        SubmitSkillReviewReq r = new SubmitSkillReviewReq();
        r.setRating(rating);
        r.setBody(body);
        r.setVersion(version);
        return r;
    }

    @Test
    void submit_requiresLogin() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.submit(1L, null, req(5, "good", "1.0.0")));
        assertEquals(40100, ex.getCode());
        verifyNoInteractions(reviewMapper, replyMapper, skillMapper);
    }

    @Test
    void submit_insertsWhenNoExistingReview_andRecomputesScore() {
        when(skillService.findById(1L)).thenReturn(skill(1L, 99L));
        when(reviewMapper.selectOne(any())).thenReturn(null);
        // load summary stubs
        when(reviewMapper.selectList(any())).thenReturn(Collections.emptyList());

        service.submit(1L, 7L, req(4, "ok", "1.0.0"));

        ArgumentCaptor<SkillReview> cap = ArgumentCaptor.forClass(SkillReview.class);
        verify(reviewMapper).insert(cap.capture());
        SkillReview saved = cap.getValue();
        assertEquals(1L, saved.getSkillId());
        assertEquals(7L, saved.getUserId());
        assertEquals(4, saved.getRating());
        assertEquals("ok", saved.getBody());
        assertEquals("1.0.0", saved.getVersion());
        verify(skillMapper).recomputeScore(1L);
    }

    @Test
    void submit_updatesWhenExistingReview() {
        when(skillService.findById(1L)).thenReturn(skill(1L, 99L));
        SkillReview existing = new SkillReview();
        existing.setId(42L);
        existing.setSkillId(1L);
        existing.setUserId(7L);
        existing.setRating(3);
        existing.setBody("old");
        existing.setVersion("0.9.0");
        when(reviewMapper.selectOne(any())).thenReturn(existing);
        when(reviewMapper.selectList(any())).thenReturn(Collections.emptyList());

        service.submit(1L, 7L, req(5, "now better", "1.1.0"));

        verify(reviewMapper, never()).insert(any());
        ArgumentCaptor<SkillReview> cap = ArgumentCaptor.forClass(SkillReview.class);
        verify(reviewMapper).updateById(cap.capture());
        SkillReview saved = cap.getValue();
        assertEquals(42L, saved.getId());
        assertEquals(5, saved.getRating());
        assertEquals("now better", saved.getBody());
        assertEquals("1.1.0", saved.getVersion());
        verify(skillMapper).recomputeScore(1L);
    }

    @Test
    void reply_rejectsNonAuthor() {
        when(skillService.findById(1L)).thenReturn(skill(1L, 99L));
        SubmitSkillReviewReplyReq r = new SubmitSkillReviewReplyReq();
        r.setBody("thanks");
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.reply(1L, 5L, 7L /* not author */, r));
        assertEquals(40300, ex.getCode());
        verifyNoInteractions(replyMapper);
    }

    @Test
    void reply_succeedsForAuthor() {
        when(skillService.findById(1L)).thenReturn(skill(1L, 99L));
        SkillReview review = new SkillReview();
        review.setId(5L);
        review.setSkillId(1L);
        when(reviewMapper.selectById(5L)).thenReturn(review);
        User author = user(99L, "lin_zr", "林子睿");
        when(userMapper.selectById(99L)).thenReturn(author);
        doAnswer(inv -> {
            SkillReviewReply row = inv.getArgument(0);
            row.setId(123L);
            row.setCreatedAt(LocalDateTime.now());
            return 1;
        }).when(replyMapper).insert(any());

        SubmitSkillReviewReplyReq r = new SubmitSkillReviewReplyReq();
        r.setBody("thanks");
        SkillReviewItem.ReplyItem out = service.reply(1L, 5L, 99L, r);

        assertEquals(123L, out.getId());
        assertEquals("thanks", out.getBody());
        assertTrue(out.getUser().getIsAuthor());
        assertEquals("林子睿", out.getUser().getName());
    }

    @Test
    void loadSummary_empty_returnsZeroAvg() {
        when(skillService.findById(1L)).thenReturn(skill(1L, 99L));
        when(reviewMapper.selectList(any())).thenReturn(Collections.emptyList());

        SkillReviewSummary s = service.loadSummary(1L, null);
        assertEquals(0L, s.getTotal());
        assertEquals(0, s.getAvg().compareTo(java.math.BigDecimal.ZERO));
        assertEquals(5, s.getDistribution().size());
        assertEquals(5, s.getDistribution().get(0).getStar());
        assertEquals(0L, s.getDistribution().get(0).getCount());
        assertNull(s.getMyReviewId());
    }

    @Test
    void loadSummary_aggregatesAvgAndMarksMine() {
        when(skillService.findById(1L)).thenReturn(skill(1L, 99L));
        SkillReview r1 = new SkillReview();
        r1.setId(11L); r1.setSkillId(1L); r1.setUserId(7L); r1.setRating(5); r1.setBody("a"); r1.setVersion("1.0.0");
        r1.setCreatedAt(LocalDateTime.now());
        SkillReview r2 = new SkillReview();
        r2.setId(12L); r2.setSkillId(1L); r2.setUserId(8L); r2.setRating(3); r2.setBody("b"); r2.setVersion("1.0.0");
        r2.setCreatedAt(LocalDateTime.now());
        when(reviewMapper.selectList(any())).thenReturn(Arrays.asList(r1, r2));
        when(replyMapper.selectList(any())).thenReturn(Collections.emptyList());
        when(userMapper.selectBatchIds(any())).thenReturn(Arrays.asList(
                user(7L, "u7", "U7"), user(8L, "u8", "U8")));

        SkillReviewSummary s = service.loadSummary(1L, 7L);
        assertEquals(2L, s.getTotal());
        // (5 + 3) / 2 = 4.00
        assertEquals(0, s.getAvg().compareTo(new java.math.BigDecimal("4.00")));
        assertEquals(11L, s.getMyReviewId());
        // 5 star bucket count = 1
        assertEquals(1L, s.getDistribution().get(0).getCount());
        // 3 star bucket count = 1
        assertEquals(1L, s.getDistribution().get(2).getCount());
        assertTrue(s.getItems().get(0).getMine() ^ s.getItems().get(1).getMine());
    }
}
