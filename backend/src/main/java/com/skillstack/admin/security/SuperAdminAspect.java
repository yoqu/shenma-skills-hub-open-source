package com.skillstack.admin.security;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Aspect
@Component
@RequiredArgsConstructor
public class SuperAdminAspect {

    private final UserMapper userMapper;

    @Before("@annotation(com.skillstack.admin.security.RequireSuperAdmin) "
            + "|| @within(com.skillstack.admin.security.RequireSuperAdmin)")
    public void requireSuperAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof CurrentUser cu) || cu.getId() == null) {
            throw new BusinessException(40100, "未登录");
        }
        User u = userMapper.selectById(cu.getId());
        if (u == null) {
            throw new BusinessException(40100, "未登录");
        }
        if (!"ACTIVE".equals(u.getStatus())) {
            throw new BusinessException(40300, "账号已被禁用");
        }
        if (!"SUPER_ADMIN".equals(u.getPlatformRole())) {
            throw new BusinessException(40300, "需要超级管理员权限");
        }
    }
}
