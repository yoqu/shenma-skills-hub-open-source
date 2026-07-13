package com.skillstack.prompt.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PromptVersionItem {
    private Long id;
    private String version;
    private String changelog;
    private String contentMd;
    private Integer refsCount;
    private String publishedAt;
}
