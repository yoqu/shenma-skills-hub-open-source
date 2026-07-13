package com.skillstack.admin.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.auth.entity.User;
import org.apache.ibatis.annotations.Mapper;

/**
 * Admin 视角的 user 跨团队查询 mapper。
 *
 * <p>分页 / 聚合查询用 JdbcTemplate 在 service 内组装，避免污染 {@link com.skillstack.auth.mapper.UserMapper}。
 * 此处仅暴露 BaseMapper 的常用 CRUD（按 id 取行、更新平台角色 / 状态等）。</p>
 */
@Mapper
public interface AdminUserMapper extends BaseMapper<User> {
}
