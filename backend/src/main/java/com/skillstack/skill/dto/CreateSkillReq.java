package com.skillstack.skill.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

// 字段说明见 README / Step3。slug / version 走正则保证最低限度合法。

/**
 * 创建 Skill 向导 4 步表单聚合提交体。
 */
@Data
public class CreateSkillReq {
    @NotBlank
    @Size(max = 128)
    private String name;

    /** team slug 后的 slug 部分，例如 "graphql-codegen" */
    @NotBlank
    @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,94}$", message = "slug 必须为小写字母 / 数字 / 短横线")
    private String slug;

    /** 一句话描述 */
    @NotBlank
    @Size(max = 512)
    private String shortDesc;

    /** 长篇 Markdown 介绍（可含图片），可选 */
    @Size(max = 50000)
    private String descriptionMd;

    /** dev/data/design/doc/devops/ai */
    @NotBlank
    private String cat;

    /** PUBLIC / TEAM_PRIVATE */
    @NotBlank
    @Pattern(regexp = "^(PUBLIC|TEAM_PRIVATE)$")
    private String visibility;

    @NotBlank
    @Pattern(regexp = "^\\d+\\.\\d+\\.\\d+(?:[-+][0-9A-Za-z.-]+)?$",
            message = "version 必须符合 SemVer,如 0.1.0")
    private String version;

    /** 所属团队 id（前端从用户选中的团队带上） */
    @NotNull
    private Long teamId;

    private String icon;

    /** 自定义上传图标 storage key（来自 /api/skills/icon-images）。 */
    private String iconKey;

    private List<String> tags;

    private List<String> langs;

    /** 上传后的文件描述，仅做计数 / 元数据展示，不入库 */
    private List<FileMeta> files;

    /** 优先使用的真实文件数；为空时回退到 files.size()。 */
    private Integer fileCount;

    /** 已上传到 storage 的 zip key，审核时用来预览文件树。 */
    private String zipUrl;

    /** 仅保存草稿（SKILL-CRT-004），不进入审核流。 */
    private Boolean draft;

    @Data
    public static class FileMeta {
        private String path;
        private Long size;
    }
}
