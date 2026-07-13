package com.skillstack.prompt.service;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.prompt.dto.PromptResolveResult;
import com.skillstack.prompt.entity.Prompt;
import com.skillstack.prompt.entity.PromptVersion;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class PromptResolveService {

    private static final int MAX_DEPTH = 10;

    private final PromptMarkdownService markdownService;
    private final PromptLookup lookup;

    public PromptResolveService(PromptMarkdownService markdownService, PromptLookup lookup) {
        this.markdownService = markdownService;
        this.lookup = lookup;
    }

    public PromptResolveResult resolve(String markdown, String currentTeamSlug, boolean raw) {
        return resolve(markdown, currentTeamSlug, raw, prompt -> {});
    }

    public PromptResolveResult resolve(String markdown,
                                       String currentTeamSlug,
                                       boolean raw,
                                       PromptAccessPolicy accessPolicy) {
        if (raw) {
            return PromptResolveResult.builder()
                    .markdown(markdown == null ? "" : markdown)
                    .resolvedRefs(List.of())
                    .build();
        }
        Map<String, PromptResolveResult.ResolvedRef> refs = new LinkedHashMap<>();
        String resolved = expand(markdown == null ? "" : markdown,
                currentTeamSlug,
                new ArrayDeque<>(),
                new HashSet<>(),
                refs,
                accessPolicy == null ? prompt -> {} : accessPolicy,
                0);
        return PromptResolveResult.builder()
                .markdown(resolved)
                .resolvedRefs(new ArrayList<>(refs.values()))
                .build();
    }

    private String expand(String markdown,
                          String currentTeamSlug,
                          ArrayDeque<String> stack,
                          Set<String> active,
                          Map<String, PromptResolveResult.ResolvedRef> refs,
                          PromptAccessPolicy accessPolicy,
                          int depth) {
        if (depth > MAX_DEPTH) {
            throw new BusinessException(40900, "Prompt 引用层级超过 " + MAX_DEPTH);
        }
        List<PromptMarkdownService.PromptMention> mentions = markdownService.extractMentions(markdown);
        if (mentions.isEmpty()) return markdown;

        StringBuilder out = new StringBuilder();
        int cursor = 0;
        for (PromptMarkdownService.PromptMention mention : mentions) {
            out.append(markdown, cursor, mention.start());
            PromptSnapshot snapshot = lookup.latestApproved(mention.teamSlug(), mention.promptSlug());
            accessPolicy.requireReadable(snapshot.prompt());
            String key = mention.teamSlug() + "/" + mention.promptSlug();
            if (active.contains(key)) {
                List<String> path = new ArrayList<>(stack);
                path.add(key);
                throw new BusinessException(40900, "Prompt 循环引用：" + String.join(" -> ", path));
            }
            refs.putIfAbsent(key, PromptResolveResult.ResolvedRef.builder()
                    .id(snapshot.prompt().getId())
                    .teamSlug(snapshot.teamSlug())
                    .slug(snapshot.prompt().getSlug())
                    .name(snapshot.prompt().getName())
                    .version(snapshot.version().getVersion())
                    .build());

            active.add(key);
            stack.addLast(key);
            String nested = expand(snapshot.version().getContentMd(), currentTeamSlug, stack, active, refs, accessPolicy, depth + 1);
            stack.removeLast();
            active.remove(key);

            out.append("\n\n<!-- prompt: ")
                    .append(snapshot.teamSlug()).append("/")
                    .append(snapshot.prompt().getSlug()).append("@")
                    .append(snapshot.version().getVersion())
                    .append(" -->\n")
                    .append(nested)
                    .append("\n<!-- /prompt -->\n\n");
            cursor = mention.end();
        }
        out.append(markdown.substring(cursor));
        return out.toString();
    }

    public interface PromptLookup {
        PromptSnapshot latestApproved(String teamSlug, String promptSlug);
    }

    @FunctionalInterface
    public interface PromptAccessPolicy {
        void requireReadable(Prompt prompt);
    }

    public record PromptSnapshot(String teamSlug, Prompt prompt, PromptVersion version) {
    }
}
