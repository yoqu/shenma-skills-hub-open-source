package com.skillstack.common.storage;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * 通用存储 key → 可访问 URL 列字段处理器。
 *
 * <p>读取时：</p>
 * <ul>
 *   <li>{@code null} / 空白 → {@code null}</li>
 *   <li>已是完整 URL（{@code http(s)://...}）或以 {@code /} 开头 → 原样返回，保证幂等</li>
 *   <li>否则视为 {@link StorageService} 的存储 key（如 {@code avatars/123/uuid.jpg}、
 *       {@code teams/1/logo.png}），拼上 {@code base-url}（默认 {@code /uploads}）返回</li>
 * </ul>
 *
 * <p>写入时：原样保存，不会反向改写已落库的 key —— 业务代码继续按 raw key 写入。</p>
 *
 * <p>典型用法 —— 在 SQL 里用 {@code COALESCE} 取 “最佳值”，
 * 再由 {@code @Result(typeHandler = StorageUrlTypeHandler.class)} 自动解析：</p>
 *
 * <pre>{@code
 * "SELECT COALESCE(u.avatar_url, u.feishu_avatar_url) AS avatarUrl, ..."
 *
 * @Results({
 *     @Result(column = "avatarUrl", property = "avatarUrl",
 *             typeHandler = StorageUrlTypeHandler.class),
 *     ...
 * })
 * }</pre>
 *
 * <p>同样适用于 team logo 等所有 “DB 存 storage key、对外吐完整 URL” 的字段。</p>
 *
 * <p><b>不要</b>把本类注册成 Spring {@code @Component}：它是 {@code BaseTypeHandler<String>}，
 * 一旦成为 Spring bean，mybatis-spring-boot 会把它注册为 String 的全局默认 TypeHandler，
 * 导致所有 POJO 映射里显式 {@code @Result} 的 String 列都被错误地拼上 {@code /uploads} 前缀。
 * 这里改由 MyBatis 自行反射实例化（无参构造），resolver 从
 * {@link StorageUrlResolverHolder} 静态获取，只在显式标注 {@code typeHandler = ...} 的列上生效。</p>
 */
public class StorageUrlTypeHandler extends BaseTypeHandler<String> {

    private static String resolve(String raw) {
        StorageUrlResolver resolver = StorageUrlResolverHolder.get();
        return resolver == null ? raw : resolver.resolveSingle(raw);
    }

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, String parameter, JdbcType jdbcType)
            throws SQLException {
        ps.setString(i, parameter);
    }

    @Override
    public String getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return resolve(rs.getString(columnName));
    }

    @Override
    public String getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return resolve(rs.getString(columnIndex));
    }

    @Override
    public String getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return resolve(cs.getString(columnIndex));
    }
}
