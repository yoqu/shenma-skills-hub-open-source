package com.skillstack.admin.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.team.entity.Team;
import org.apache.ibatis.annotations.Mapper;

/**
 * Admin 视角的 team 跨团队查询 mapper。
 *
 * <p>列表与聚合查询用 JdbcTemplate 在 service 内组装。</p>
 */
@Mapper
public interface AdminTeamMapper extends BaseMapper<Team> {
}
