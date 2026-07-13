package com.skillstack.review.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * 作者编辑 review payload 的输入体（PATCH /api/reviews/:id 和 resubmit 时复用）。
 * 字段全部可选 - 仅更新非空字段，便于支持部分编辑。
 */
@Data
public class ReviewPayloadReq {
    @Size(max = 128)
    private String name;

    @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,94}$", message = "slug 必须为小写字母 / 数字 / 短横线")
    private String slug;

    @Size(max = 512)
    private String shortDesc;

    /** Skill 长篇 Markdown 介绍 */
    @Size(max = 50000)
    private String descriptionMd;

    private String cat;

    @Pattern(regexp = "^(PUBLIC|TEAM_PRIVATE)$")
    private String visibility;

    @Pattern(regexp = "^\\d+\\.\\d+\\.\\d+(?:[-+][0-9A-Za-z.-]+)?$",
            message = "version 必须符合 SemVer,如 0.1.0")
    private String version;

    private String icon;

    /** 自定义上传图标 storage key；null=不变，""=清除，非空=替换。 */
    private String iconKey;

    private List<String> tags;

    private List<String> langs;

    private Integer filesCount;

    private String zipUrl;

    /** Prompt 专用：Markdown 正文 */
    private String contentMd;

    /** Prompt 专用：版本变更说明 */
    private String changelog;
}
