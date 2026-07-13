package com.skillstack.prompt.service;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.prompt.dto.PromptResolveResult;
import com.skillstack.prompt.entity.Prompt;
import com.skillstack.prompt.entity.PromptVersion;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PromptResolveServiceTest {

    @Test
    void resolvesReferencesToLatestApprovedVersion() {
        FakePromptLookup lookup = new FakePromptLookup();
        lookup.add("ludou-fe", "base-role", "1.0.0", "old role");
        lookup.add("ludou-fe", "base-role", "1.2.0", "new role");
        PromptResolveService service = new PromptResolveService(new PromptMarkdownService(), lookup);

        PromptResolveResult result = service.resolve("""
                Do task with @[基础角色](skillstack://prompt/ludou-fe/base-role).
                """, "ludou-fe", false);

        assertThat(result.getMarkdown()).contains("new role");
        assertThat(result.getMarkdown()).doesNotContain("old role");
        assertThat(result.getResolvedRefs()).singleElement().satisfies(ref -> {
            assertThat(ref.getTeamSlug()).isEqualTo("ludou-fe");
            assertThat(ref.getSlug()).isEqualTo("base-role");
            assertThat(ref.getVersion()).isEqualTo("1.2.0");
        });
    }

    @Test
    void detectsCyclesAcrossPromptReferences() {
        FakePromptLookup lookup = new FakePromptLookup();
        lookup.add("ludou-fe", "a", "1.0.0", "A -> @[B](skillstack://prompt/ludou-fe/b)");
        lookup.add("ludou-fe", "b", "1.0.0", "B -> @[A](skillstack://prompt/ludou-fe/a)");
        PromptResolveService service = new PromptResolveService(new PromptMarkdownService(), lookup);

        assertThatThrownBy(() -> service.resolve(
                "@[A](skillstack://prompt/ludou-fe/a)",
                "ludou-fe",
                false))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("循环引用");
    }

    private static final class FakePromptLookup implements PromptResolveService.PromptLookup {
        private final Map<String, PromptResolveService.PromptSnapshot> latest = new HashMap<>();

        void add(String teamSlug, String slug, String version, String content) {
            Prompt prompt = new Prompt();
            prompt.setId((long) (teamSlug + "/" + slug).hashCode());
            prompt.setTeamId(1L);
            prompt.setSlug(slug);
            prompt.setName(slug);
            prompt.setVisibility("TEAM_PRIVATE");
            prompt.setStatus("APPROVED");

            PromptVersion promptVersion = new PromptVersion();
            promptVersion.setId((long) (teamSlug + "/" + slug + "@" + version).hashCode());
            promptVersion.setPromptId(prompt.getId());
            promptVersion.setVersion(version);
            promptVersion.setContentMd(content);
            promptVersion.setPublishedAt(LocalDateTime.now());

            latest.put(teamSlug + "/" + slug,
                    new PromptResolveService.PromptSnapshot(teamSlug, prompt, promptVersion));
        }

        @Override
        public PromptResolveService.PromptSnapshot latestApproved(String teamSlug, String promptSlug) {
            PromptResolveService.PromptSnapshot snapshot = latest.get(teamSlug + "/" + promptSlug);
            if (snapshot == null) {
                throw new BusinessException(40400, "Prompt 不存在");
            }
            return snapshot;
        }
    }
}
