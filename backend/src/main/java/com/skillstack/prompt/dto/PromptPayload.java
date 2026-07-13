package com.skillstack.prompt.dto;

import lombok.Data;

import java.util.List;

@Data
public class PromptPayload {
    private String kind;
    private String slug;
    private String name;
    private String shortDesc;
    private String cat;
    private String visibility;
    private String version;
    private String contentMd;
    private String changelog;
    private List<String> tags;
}
