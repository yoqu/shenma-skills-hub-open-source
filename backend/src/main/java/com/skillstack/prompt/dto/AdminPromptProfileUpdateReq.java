package com.skillstack.prompt.dto;

import lombok.Data;

import java.util.List;

/**
 * 管理员维护已上线 Prompt 的展示元信息。
 */
@Data
public class AdminPromptProfileUpdateReq {
    private String name;
    private String shortDesc;
    private String cat;
    private String visibility;
    private List<String> tags;
    /** 自定义上传图标 storage key；null=不变，""=清除，非空=替换。 */
    private String iconKey;
}
