package com.skillstack.skill.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** {@code POST /api/skills/versions/parse} 返回体。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillParseResult {

    /** 解析的存储 key,等同请求里的 zipUrl。 */
    private String zipUrl;
    /** 文件大小(字节)。 */
    private long size;
    /** 内容的 sha256(十六进制小写)。 */
    private String sha256;
    /** zip 中的条目数(目录 + 文件)。 */
    private int entryCount;
    /** zip 中的文件数(不计目录)。 */
    private int fileCount;
    /** SKILL.md 路径,缺失时为 null。 */
    private String skillMdPath;

    /** 是否存在 SKILL.md。 */
    private boolean hasSkillMd;
    /** 是否解析出 frontmatter。 */
    private boolean hasFrontmatter;

    /** 从 SKILL.md frontmatter 中解析出的元数据(尽力,字段可能缺失)。 */
    private ParsedMeta parsed;

    /** 校验项列表,前端可直接渲染。 */
    private List<Check> checks;
    /** 是否所有 fail 状态都不存在。 */
    private boolean ok;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ParsedMeta {
        private String name;
        private String version;
        private String description;
        private String category;
        private List<String> tags;
        private List<String> langs;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Check {
        /** pass / warn / fail */
        private String status;
        private String name;
        private String detail;
    }
}
