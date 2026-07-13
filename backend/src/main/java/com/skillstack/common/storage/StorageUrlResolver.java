package com.skillstack.common.storage;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 通用存储 URL 解析（avatar / team logo / 任意上传文件）。
 *
 * <p>两类入口：</p>
 * <ol>
 *   <li>{@link #resolveSingle(String)} — 单值入口，与 {@link StorageUrlTypeHandler} 行为一致。
 *       MyBatis 之外（实体 → DTO 的命令式装配、{@code JdbcTemplate}、Controller 上传响应）直接调用。</li>
 *   <li>{@link #resolve(String, String)} — 双值入口，按 “主值 → 兜底值” 优先级择一并解析
 *       （典型场景：{@code avatar_url} → {@code feishu_avatar_url}）。SQL 里推荐改成
 *       {@code COALESCE(...) AS xxx} 配合 {@link StorageUrlTypeHandler}，
 *       此入口保留给少量命令式装配场景（如 {@code MeRes}、{@code buildPublicProfile}）。</li>
 * </ol>
 *
 * <p>MyBatis Mapper 优先使用 {@link StorageUrlTypeHandler} 注解，不要在 Service 里再循环 resolve。</p>
 */
@Component
@RequiredArgsConstructor
public class StorageUrlResolver {

    private final StorageService storageService;

    /**
     * 把单个值规整成可访问 URL：
     * <ul>
     *   <li>{@code null}/ 空白 → {@code null}</li>
     *   <li>已是完整 URL（{@code http(s)://...} 或 {@code /} 开头） → 原样返回（幂等）</li>
     *   <li>否则视为 {@link StorageService} 存储 key，拼上 {@code base-url} 返回</li>
     * </ul>
     */
    public String resolveSingle(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (isAlreadyUrl(value)) {
            return value;
        }
        return storageService.resolveUrl(value);
    }

    /** 按 “主值 → 兜底值” 优先级择一并解析。典型用例：本地上传头像 → 飞书 SSO 头像。 */
    public String resolve(String primaryKey, String fallback) {
        if (primaryKey != null && !primaryKey.isBlank()) {
            return resolveSingle(primaryKey);
        }
        return resolveSingle(fallback);
    }

    private static boolean isAlreadyUrl(String v) {
        return v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/");
    }
}
