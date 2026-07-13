package com.skillstack.common.storage;

import org.springframework.stereotype.Component;

/**
 * 把 Spring 管理的 {@link StorageUrlResolver} 暴露给非 Spring 实例化的对象。
 *
 * <p>{@link StorageUrlTypeHandler} 由 MyBatis 自己反射实例化（不是 Spring bean），
 * 拿不到注入的 resolver，因此通过本 holder 在启动时把单例 resolver 暂存为静态引用。</p>
 *
 * <p>注意：{@code StorageUrlTypeHandler} 不能再注册成 Spring {@code @Component}，
 * 否则 mybatis-spring-boot 会把它当作 {@code TypeHandler<String>} 注册为 String 的全局默认处理器，
 * 导致所有 POJO 映射的 String 列都被错误地拼上 {@code /uploads} 前缀。</p>
 */
@Component
public class StorageUrlResolverHolder {

    private static volatile StorageUrlResolver resolver;

    public StorageUrlResolverHolder(StorageUrlResolver resolver) {
        StorageUrlResolverHolder.resolver = resolver;
    }

    public static StorageUrlResolver get() {
        return resolver;
    }
}
