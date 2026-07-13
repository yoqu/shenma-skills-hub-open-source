package com.skillstack.admin.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.skill.entity.Skill;
import org.apache.ibatis.annotations.Mapper;

/**
 * Admin 视角的 skill 跨团队查询 mapper。
 *
 * <p>列表查询用 JdbcTemplate 在 service 内组装；下架用 BaseMapper.updateById 即可。</p>
 */
@Mapper
public interface AdminSkillMapper extends BaseMapper<Skill> {
}
