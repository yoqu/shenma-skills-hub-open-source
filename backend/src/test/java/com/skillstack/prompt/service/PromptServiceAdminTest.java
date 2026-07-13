package com.skillstack.prompt.service;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.prompt.dto.AdminPromptProfileUpdateReq;
import com.skillstack.prompt.entity.Prompt;
import com.skillstack.prompt.mapper.PromptMapper;
import com.skillstack.skill.entity.Category;
import com.skillstack.skill.service.CategoryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PromptServiceAdminTest {

    private PromptMapper promptMapper;
    private TeamAccessGuard guard;
    private CategoryService categoryService;
    private PromptService service;

    @BeforeEach
    void setUp() {
        promptMapper = mock(PromptMapper.class);
        guard = mock(TeamAccessGuard.class);
        categoryService = mock(CategoryService.class);
        service = new PromptService(
                promptMapper,
                mock(com.skillstack.prompt.mapper.PromptVersionMapper.class),
                mock(com.skillstack.prompt.mapper.PromptTagMapper.class),
                mock(com.skillstack.prompt.mapper.PromptRefMapper.class),
                mock(com.skillstack.skill.mapper.TagMapper.class),
                mock(com.skillstack.review.mapper.ReviewMapper.class),
                guard,
                mock(com.skillstack.team.service.TeamService.class),
                categoryService,
                new PromptMarkdownService(),
                mock(PromptResolveService.class),
                mock(com.skillstack.common.storage.StorageUrlResolver.class),
                mock(com.skillstack.common.storage.StorageService.class)
        );
    }

    @Test
    void updateVisibilityRequiresWriterAndUpdatesPrompt() {
        Prompt prompt = prompt();
        when(promptMapper.selectById(7L)).thenReturn(prompt);

        service.updateVisibility(7L, "PUBLIC", 2L);

        verify(guard).requireWriter(1L, 2L);
        verify(promptMapper).updateById(org.mockito.ArgumentMatchers.argThat(p ->
                "PUBLIC".equals(p.getVisibility())
        ));
    }

    @Test
    void updateStatusRejectsUnsupportedCurrentState() {
        Prompt prompt = prompt();
        prompt.setStatus("PENDING_REVIEW");
        when(promptMapper.selectById(7L)).thenReturn(prompt);

        assertThatThrownBy(() -> service.updateStatus(7L, "UNLISTED", 2L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("当前状态不支持上下架");
    }

    @Test
    void updateAdminProfileRewritesMetadataAndTags() {
        Prompt prompt = prompt();
        when(promptMapper.selectById(7L)).thenReturn(prompt);
        Category cat = new Category();
        cat.setCode("ai");
        when(categoryService.findByCode("ai")).thenReturn(cat);

        AdminPromptProfileUpdateReq req = new AdminPromptProfileUpdateReq();
        req.setName("新版 Prompt");
        req.setShortDesc("新版说明");
        req.setCat("ai");
        req.setVisibility("TEAM_PRIVATE");
        req.setTags(List.of("review", "agent"));

        service.updateAdminProfile(7L, req, 2L);

        verify(guard).requireWriter(1L, 2L);
        verify(promptMapper).updateById(org.mockito.ArgumentMatchers.argThat(p ->
                "新版 Prompt".equals(p.getName())
                        && "新版说明".equals(p.getShortDesc())
                        && "ai".equals(p.getCatCode())
                        && "TEAM_PRIVATE".equals(p.getVisibility())
        ));
    }

    @Test
    void softDeleteRequiresWriterAndDeletesPrompt() {
        when(promptMapper.selectById(7L)).thenReturn(prompt());

        service.softDelete(7L, 2L);

        verify(guard).requireWriter(1L, 2L);
        verify(promptMapper).deleteById(7L);
    }

    private static Prompt prompt() {
        Prompt prompt = new Prompt();
        prompt.setId(7L);
        prompt.setTeamId(1L);
        prompt.setName("Prompt");
        prompt.setShortDesc("desc");
        prompt.setCatCode("ai");
        prompt.setVisibility("TEAM_PRIVATE");
        prompt.setStatus("APPROVED");
        prompt.setVersion("0.1.0");
        return prompt;
    }
}
