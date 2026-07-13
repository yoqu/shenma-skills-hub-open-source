package com.skillstack.prompt.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.prompt.entity.PromptVersion;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface PromptVersionMapper extends BaseMapper<PromptVersion> {

    @Select("""
            SELECT *
              FROM prompt_versions
             WHERE prompt_id = #{promptId}
               AND deleted = 0
             ORDER BY published_at DESC, id DESC
            """)
    List<PromptVersion> listByPrompt(@Param("promptId") Long promptId);
}
