package com.skillstack.admin.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标注在 controller 方法或类上，要求调用者为 ACTIVE 的 SUPER_ADMIN。
 * 由 {@link SuperAdminAspect} 在运行时校验。
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequireSuperAdmin {
}
