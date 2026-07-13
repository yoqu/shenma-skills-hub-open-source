package com.skillstack.prompt.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PromptResolveResult {
    private String markdown;
    @Builder.Default
    private List<ResolvedRef> resolvedRefs = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ResolvedRef {
        private Long id;
        private String teamSlug;
        private String slug;
        private String name;
        private String version;
    }
}
