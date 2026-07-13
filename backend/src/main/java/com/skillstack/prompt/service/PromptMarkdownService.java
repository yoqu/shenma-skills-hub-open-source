package com.skillstack.prompt.service;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class PromptMarkdownService {

    private static final Pattern PROMPT_LINK = Pattern.compile(
            "@\\[([^\\]]+)]\\(skillstack://prompt/([a-z0-9][a-z0-9-]*)/([a-z0-9][a-z0-9-]*)\\)");

    public List<PromptMention> extractMentions(String markdown) {
        if (markdown == null || markdown.isBlank()) return List.of();
        Matcher matcher = PROMPT_LINK.matcher(markdown);
        List<PromptMention> out = new ArrayList<>();
        int pos = 0;
        while (matcher.find()) {
            out.add(new PromptMention(
                    matcher.group(1),
                    matcher.group(2),
                    matcher.group(3),
                    pos++,
                    matcher.start(),
                    matcher.end(),
                    matcher.group(0)
            ));
        }
        return out;
    }

    public record PromptMention(
            String label,
            String teamSlug,
            String promptSlug,
            int position,
            int start,
            int end,
            String raw
    ) {
    }
}
