package com.skillstack.prompt.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class PromptDetail {
    private Long id;
    private String slug;
    private String teamSlug;
    private String teamName;
    private String name;
    private String shortDesc;
    private String cat;
    private String catName;
    /** 自定义上传图标完整 URL（无则为 null） */
    private String iconUrl;
    private String visibility;
    private String status;
    private String version;
    private BigDecimal score;
    private Integer stars;
    private Integer exports;
    private String contentMd;
    private PromptResolveResult resolved;
    private List<String> tags;
    private PromptCard.AuthorRef author;
}
