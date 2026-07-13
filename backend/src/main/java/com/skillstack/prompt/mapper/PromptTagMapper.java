package com.skillstack.prompt.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.prompt.entity.PromptTag;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface PromptTagMapper extends BaseMapper<PromptTag> {

    @Select("""
            SELECT t.name
              FROM tags t
              JOIN prompt_tags pt ON pt.tag_id = t.id AND pt.deleted = 0
             WHERE pt.prompt_id = #{promptId}
               AND t.deleted = 0
             ORDER BY pt.id ASC
            """)
    List<String> selectTagNamesByPrompt(@Param("promptId") Long promptId);
}
