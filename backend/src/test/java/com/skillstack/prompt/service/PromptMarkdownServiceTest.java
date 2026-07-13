package com.skillstack.prompt.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PromptMarkdownServiceTest {

    private final PromptMarkdownService service = new PromptMarkdownService();

    @Test
    void extractsPromptReferencesInMarkdownOrder() {
        List<PromptMarkdownService.PromptMention> refs = service.extractMentions("""
                # Root

                Use @[基础角色](skillstack://prompt/ludou-fe/base-role)
                and @[错误格式](skillstack://prompt/ludou-fe/error-format).
                """);

        assertThat(refs).hasSize(2);
        assertThat(refs.get(0).label()).isEqualTo("基础角色");
        assertThat(refs.get(0).teamSlug()).isEqualTo("ludou-fe");
        assertThat(refs.get(0).promptSlug()).isEqualTo("base-role");
        assertThat(refs.get(0).position()).isEqualTo(0);
        assertThat(refs.get(1).label()).isEqualTo("错误格式");
        assertThat(refs.get(1).promptSlug()).isEqualTo("error-format");
        assertThat(refs.get(1).position()).isEqualTo(1);
    }

    @Test
    void ignoresNonPromptLinks() {
        List<PromptMarkdownService.PromptMention> refs = service.extractMentions("""
                [普通链接](https://example.com)
                @[坏链接](skillstack://skill/ludou-fe/foo)
                @[合法](skillstack://prompt/ludou-fe/legal)
                """);

        assertThat(refs).extracting(PromptMarkdownService.PromptMention::promptSlug)
                .containsExactly("legal");
    }
}
