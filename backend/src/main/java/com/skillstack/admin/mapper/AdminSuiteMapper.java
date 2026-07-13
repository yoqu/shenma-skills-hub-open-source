package com.skillstack.admin.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.suite.entity.Suite;
import org.apache.ibatis.annotations.Mapper;

/**
 * Admin 视角的 suite 跨团队查询 mapper。
 *
 * <p>列表查询用 JdbcTemplate 在 service 内组装；下架用 BaseMapper.updateById 即可。</p>
 */
@Mapper
public interface AdminSuiteMapper extends BaseMapper<Suite> {
}
