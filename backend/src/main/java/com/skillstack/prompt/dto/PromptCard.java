package com.skillstack.prompt.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PromptCard {
    private Long id;
    private String slug;
    private String teamSlug;
    private String name;
    private String shortDesc;
    private String cat;
    /** 自定义上传图标完整 URL（无则为 null，前端回退到默认 code 图标） */
    private String iconUrl;
    private String visibility;
    private String status;
    private String version;
    private BigDecimal score;
    private Integer stars;
    private Integer exports;
    private String updated;
    private List<String> tags;
    private AuthorRef author;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AuthorRef {
        private Long id;
        private String name;
        private String handle;
    }
}
