package com.skillstack.prompt.service;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.prompt.dto.CreatePromptReq;
import com.skillstack.prompt.dto.PromptResolveResult;
import com.skillstack.prompt.entity.Prompt;
import com.skillstack.prompt.mapper.PromptMapper;
import com.skillstack.review.entity.Review;
import com.skillstack.review.mapper.ReviewMapper;
import com.skillstack.skill.entity.Category;
import com.skillstack.skill.service.CategoryService;
import com.skillstack.team.entity.Team;
import com.skillstack.team.dto.TeamDetailRes;
import com.skillstack.team.service.TeamService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PromptServiceReferencePolicyTest {

    @Test
    void publicPromptCannotReferencePrivatePrompt() {
        PromptMapper promptMapper = mock(PromptMapper.class);
        Prompt target = new Prompt();
        target.setId(8L);
        target.setStatus("APPROVED");
        target.setVisibility("TEAM_PRIVATE");
        target.setCurrentVersionId(88L);
        when(promptMapper.selectByTeamSlugAndSlug("ludou-fe", "private-context")).thenReturn(target);

        PromptService service = new PromptService(
                promptMapper,
                mock(com.skillstack.prompt.mapper.PromptVersionMapper.class),
                mock(com.skillstack.prompt.mapper.PromptTagMapper.class),
                mock(com.skillstack.prompt.mapper.PromptRefMapper.class),
                mock(com.skillstack.skill.mapper.TagMapper.class),
                mock(com.skillstack.review.mapper.ReviewMapper.class),
                mock(com.skillstack.common.security.TeamAccessGuard.class),
                mock(com.skillstack.team.service.TeamService.class),
                mock(com.skillstack.skill.service.CategoryService.class),
                new PromptMarkdownService(),
                mock(PromptResolveService.class),
                mock(com.skillstack.common.storage.StorageUrlResolver.class),
                mock(com.skillstack.common.storage.StorageService.class)
        );

        assertThatThrownBy(() -> service.validateReferencePolicy(
                "@[私有上下文](skillstack://prompt/ludou-fe/private-context)",
                "PUBLIC"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("公开 Prompt 不能引用团队私有 Prompt");
    }

    @Test
    void crossTeamPromptReferencesAreRejectedInFirstPhase() {
        PromptMapper promptMapper = mock(PromptMapper.class);
        Prompt target = new Prompt();
        target.setId(8L);
        target.setTeamId(99L);
        target.setStatus("APPROVED");
        target.setVisibility("PUBLIC");
        target.setCurrentVersionId(88L);
        when(promptMapper.selectByTeamSlugAndSlug("other-team", "public-context")).thenReturn(target);

        PromptService service = new PromptService(
                promptMapper,
                mock(com.skillstack.prompt.mapper.PromptVersionMapper.class),
                mock(com.skillstack.prompt.mapper.PromptTagMapper.class),
                mock(com.skillstack.prompt.mapper.PromptRefMapper.class),
                mock(com.skillstack.skill.mapper.TagMapper.class),
                mock(com.skillstack.review.mapper.ReviewMapper.class),
                mock(com.skillstack.common.security.TeamAccessGuard.class),
                mock(com.skillstack.team.service.TeamService.class),
                mock(com.skillstack.skill.service.CategoryService.class),
                new PromptMarkdownService(),
                mock(PromptResolveService.class),
                mock(com.skillstack.common.storage.StorageUrlResolver.class),
                mock(com.skillstack.common.storage.StorageService.class)
        );

        assertThatThrownBy(() -> service.validateReferencePolicy(
                "@[公开上下文](skillstack://prompt/other-team/public-context)",
                "TEAM_PRIVATE",
                2L,
                1L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("暂不支持跨团队引用");
    }

    @Test
    void resolveRequiresReadAccessForPrivatePromptReferences() {
        PromptMapper promptMapper = mock(PromptMapper.class);
        TeamAccessGuard guard = mock(TeamAccessGuard.class);
        TeamService teamService = mock(TeamService.class);
        PromptResolveService resolveService = mock(PromptResolveService.class);
        TeamDetailRes sourceTeam = new TeamDetailRes();
        sourceTeam.setId(1L);
        sourceTeam.setSlug("ludou-fe");
        when(teamService.getBySlug("ludou-fe")).thenReturn(sourceTeam);
        Prompt target = new Prompt();
        target.setId(8L);
        target.setTeamId(99L);
        target.setStatus("APPROVED");
        target.setVisibility("TEAM_PRIVATE");
        target.setCurrentVersionId(88L);
        when(promptMapper.selectByTeamSlugAndSlug("other-team", "private-context")).thenReturn(target);
        doThrow(new BusinessException(40300, "需要团队成员权限"))
                .when(guard).requireMember(99L, 2L);
        when(resolveService.resolve(any(), any(), any(Boolean.class), any()))
                .thenReturn(PromptResolveResult.builder().markdown("resolved").build());

        PromptService service = new PromptService(
                promptMapper,
                mock(com.skillstack.prompt.mapper.PromptVersionMapper.class),
                mock(com.skillstack.prompt.mapper.PromptTagMapper.class),
                mock(com.skillstack.prompt.mapper.PromptRefMapper.class),
                mock(com.skillstack.skill.mapper.TagMapper.class),
                mock(com.skillstack.review.mapper.ReviewMapper.class),
                guard,
                teamService,
                mock(com.skillstack.skill.service.CategoryService.class),
                new PromptMarkdownService(),
                resolveService,
                mock(com.skillstack.common.storage.StorageUrlResolver.class),
                mock(com.skillstack.common.storage.StorageService.class)
        );

        assertThatThrownBy(() -> service.resolve(
                "@[私有上下文](skillstack://prompt/other-team/private-context)",
                "ludou-fe",
                false,
                2L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("需要团队成员权限");
    }

    @Test
    void reviewRequiredCreateReturnsPendingReviewWithNullAssetId() {
        ReviewMapper reviewMapper = mock(ReviewMapper.class);
        TeamService teamService = mock(TeamService.class);
        CategoryService categoryService = mock(CategoryService.class);

        Team team = new Team();
        team.setId(1L);
        team.setReviewMode("REVIEW_REQUIRED");
        when(teamService.requireTeam(1L)).thenReturn(team);

        Category category = new Category();
        category.setCode("ai");
        when(categoryService.findByCode("ai")).thenReturn(category);

        when(reviewMapper.insert(any(Review.class))).thenAnswer(invocation -> {
            Review review = invocation.getArgument(0);
            review.setId(42L);
            return 1;
        });

        PromptService service = new PromptService(
                mock(PromptMapper.class),
                mock(com.skillstack.prompt.mapper.PromptVersionMapper.class),
                mock(com.skillstack.prompt.mapper.PromptTagMapper.class),
                mock(com.skillstack.prompt.mapper.PromptRefMapper.class),
                mock(com.skillstack.skill.mapper.TagMapper.class),
                reviewMapper,
                mock(com.skillstack.common.security.TeamAccessGuard.class),
                teamService,
                categoryService,
                new PromptMarkdownService(),
                mock(PromptResolveService.class),
                mock(com.skillstack.common.storage.StorageUrlResolver.class),
                mock(com.skillstack.common.storage.StorageService.class)
        );

        CreatePromptReq req = new CreatePromptReq();
        req.setTeamId(1L);
        req.setSlug("review-required-prompt");
        req.setName("Review Required Prompt");
        req.setShortDesc("A prompt waiting for review");
        req.setCat("ai");
        req.setVisibility("PUBLIC");
        req.setVersion("0.1.0");
        req.setContentMd("# Prompt\n\nReview me.");
        req.setChangelog("initial");
        req.setTags(List.of("prompt"));

        Map<String, Object> result = service.create(req, 2L);

        assertThat(result)
                .containsEntry("id", null)
                .containsEntry("slug", "review-required-prompt")
                .containsEntry("status", "PENDING_REVIEW")
                .containsEntry("pendingReview", true)
                .containsEntry("reviewId", 42L);
        verify(reviewMapper).insert(any(Review.class));
    }

    @Test
    void reviewRequiredCreateRejectsPromptSlugHeldByOpenReviewInSameTeam() {
        ReviewMapper reviewMapper = mock(ReviewMapper.class);
        TeamService teamService = mock(TeamService.class);
        CategoryService categoryService = mock(CategoryService.class);

        Team team = new Team();
        team.setId(1L);
        team.setReviewMode("REVIEW_REQUIRED");
        when(teamService.requireTeam(1L)).thenReturn(team);

        Category category = new Category();
        category.setCode("ai");
        when(categoryService.findByCode("ai")).thenReturn(category);
        when(reviewMapper.countOpenPromptReviewByTeamAndSlug(1L, "dup-prompt", null)).thenReturn(1L);

        PromptService service = new PromptService(
                mock(PromptMapper.class),
                mock(com.skillstack.prompt.mapper.PromptVersionMapper.class),
                mock(com.skillstack.prompt.mapper.PromptTagMapper.class),
                mock(com.skillstack.prompt.mapper.PromptRefMapper.class),
                mock(com.skillstack.skill.mapper.TagMapper.class),
                reviewMapper,
                mock(com.skillstack.common.security.TeamAccessGuard.class),
                teamService,
                categoryService,
                new PromptMarkdownService(),
                mock(PromptResolveService.class),
                mock(com.skillstack.common.storage.StorageUrlResolver.class),
                mock(com.skillstack.common.storage.StorageService.class)
        );

        CreatePromptReq req = new CreatePromptReq();
        req.setTeamId(1L);
        req.setSlug("dup-prompt");
        req.setName("Duplicate Prompt");
        req.setShortDesc("A duplicate prompt");
        req.setCat("ai");
        req.setVisibility("PUBLIC");
        req.setVersion("0.1.0");
        req.setContentMd("# Prompt\n\nDuplicate me.");

        assertThatThrownBy(() -> service.create(req, 2L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Prompt slug 已被占用");
        verify(reviewMapper, org.mockito.Mockito.never()).insert(any(Review.class));
    }
}
