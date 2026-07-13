package com.skillstack.review.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * 审核包文件树（REV-007）。
 *
 * <p>从 reviews.zip_url 或对应 skill_versions.zip_url 指向的 zip 解析。</p>
 */
@Data
public class ReviewFileTree {
    /** zip 是否存在 / 是否能解析 */
    private boolean available;
    /** zip 不可用时的说明：未上传 / 解析失败 等 */
    private String message;
    /** 文件列表，按相对路径排序 */
    private List<Entry> entries;
    /** 文本文件内容字典：path → 文本内容（≤ 64KB 的才填）。 */
    private Map<String, String> contents;

    @Data
    public static class Entry {
        private String path;
        /** "dir" / "md" / "json" / "ts" / "txt" 等扩展名（不含点） */
        private String type;
        private boolean binary;
        private long size;
    }
}
