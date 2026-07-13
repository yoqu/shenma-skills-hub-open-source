package com.skillstack.skill.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.skill.entity.SkillTag;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SkillTagMapper extends BaseMapper<SkillTag> {

    /** 取 skill 的全部 tag name */
    @Select("""
            SELECT t.name
              FROM tags t
              JOIN skill_tags st ON st.tag_id = t.id AND st.deleted = 0
             WHERE st.skill_id = #{skillId}
               AND t.deleted = 0
             ORDER BY st.id ASC
            """)
    List<String> selectTagNamesBySkill(@Param("skillId") Long skillId);
}
