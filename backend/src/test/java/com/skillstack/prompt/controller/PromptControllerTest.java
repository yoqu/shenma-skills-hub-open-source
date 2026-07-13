package com.skillstack.prompt.controller;

import com.skillstack.common.web.PageQuery;
import com.skillstack.common.web.PageResult;
import com.skillstack.prompt.dto.PromptCard;
import com.skillstack.prompt.service.PromptService;
import com.skillstack.asset.service.AssetReviewService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PromptControllerTest {

    private MockMvc mockMvc;
    private PromptService promptService;

    @BeforeEach
    void setUp() {
        promptService = mock(PromptService.class);
        AssetReviewService assetReviewService = mock(AssetReviewService.class);
        PromptController controller = new PromptController(
                promptService,
                assetReviewService,
                mock(com.skillstack.common.storage.StorageService.class));
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void publicPromptListForwardsKeywordToService() throws Exception {
        PageResult<PromptCard> empty = PageResult.of(List.of(), 0, 1, 20);
        when(promptService.listPublic(any(PageQuery.class), eq("review-agent"))).thenReturn(empty);

        mockMvc.perform(get("/api/prompts")
                        .param("q", "review-agent")
                        .param("page", "1")
                        .param("size", "20"))
                .andExpect(status().isOk());

        verify(promptService).listPublic(any(PageQuery.class), eq("review-agent"));
    }
}
