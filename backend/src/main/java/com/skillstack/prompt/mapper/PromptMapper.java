package com.skillstack.prompt.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.prompt.entity.Prompt;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

@Mapper
public interface PromptMapper extends BaseMapper<Prompt> {

    @Select({
            "<script>",
            "SELECT p.*, t.slug AS team_slug, t.name AS team_name,",
            "       u.name AS author_name, u.handle AS author_handle,",
            "       c.name AS cat_name",
            "  FROM prompts p",
            "  JOIN teams t ON t.id = p.team_id AND t.deleted = 0",
            "  LEFT JOIN users u ON u.id = p.author_id AND u.deleted = 0",
            "  LEFT JOIN categories c ON c.code = p.cat_code AND c.deleted = 0",
            " WHERE p.deleted = 0",
            "   AND p.visibility = 'PUBLIC'",
            "   AND p.status = 'APPROVED'",
            "   AND COALESCE(t.public_home, 1) = 1",
            "   <if test='q != null and q != \"\"'>",
            "      AND (p.name LIKE CONCAT('%', #{q}, '%')",
            "        OR p.slug LIKE CONCAT('%', #{q}, '%')",
            "        OR p.short_desc LIKE CONCAT('%', #{q}, '%')",
            "        OR p.cat_code LIKE CONCAT('%', #{q}, '%')",
            "        OR EXISTS (",
            "             SELECT 1 FROM prompt_tags pt",
            "             JOIN tags tag ON tag.id = pt.tag_id AND tag.deleted = 0",
            "            WHERE pt.prompt_id = p.id",
            "              AND pt.deleted = 0",
            "              AND tag.name LIKE CONCAT('%', #{q}, '%')",
            "        ))",
            "   </if>",
            " ORDER BY p.published_at DESC, p.id DESC",
            " LIMIT #{offset}, #{size}",
            "</script>"
    })
    List<Map<String, Object>> selectPublicPrompts(@Param("q") String q,
                                                  @Param("offset") long offset,
                                                  @Param("size") long size);

    @Select({
            "<script>",
            "SELECT COUNT(*)",
            "  FROM prompts p",
            "  JOIN teams t ON t.id = p.team_id AND t.deleted = 0",
            " WHERE p.deleted = 0",
            "   AND p.visibility = 'PUBLIC'",
            "   AND p.status = 'APPROVED'",
            "   AND COALESCE(t.public_home, 1) = 1",
            "   <if test='q != null and q != \"\"'>",
            "      AND (p.name LIKE CONCAT('%', #{q}, '%')",
            "        OR p.slug LIKE CONCAT('%', #{q}, '%')",
            "        OR p.short_desc LIKE CONCAT('%', #{q}, '%')",
            "        OR p.cat_code LIKE CONCAT('%', #{q}, '%')",
            "        OR EXISTS (",
            "             SELECT 1 FROM prompt_tags pt",
            "             JOIN tags tag ON tag.id = pt.tag_id AND tag.deleted = 0",
            "            WHERE pt.prompt_id = p.id",
            "              AND pt.deleted = 0",
            "              AND tag.name LIKE CONCAT('%', #{q}, '%')",
            "        ))",
            "   </if>",
            "</script>"
    })
    long countPublicPrompts(@Param("q") String q);

    @Select("""
            SELECT p.*, t.slug AS team_slug, t.name AS team_name,
                   u.name AS author_name, u.handle AS author_handle,
                   c.name AS cat_name
              FROM prompts p
              JOIN teams t ON t.id = p.team_id AND t.deleted = 0
              LEFT JOIN users u ON u.id = p.author_id AND u.deleted = 0
              LEFT JOIN categories c ON c.code = p.cat_code AND c.deleted = 0
             WHERE p.deleted = 0
               AND t.slug = #{teamSlug}
               AND p.slug = #{promptSlug}
             LIMIT 1
            """)
    Map<String, Object> selectDetailByTeamAndSlug(@Param("teamSlug") String teamSlug,
                                                  @Param("promptSlug") String promptSlug);

    @Select("""
            SELECT p.*
              FROM prompts p
              JOIN teams t ON t.id = p.team_id AND t.deleted = 0
             WHERE p.deleted = 0
               AND t.slug = #{teamSlug}
               AND p.slug = #{promptSlug}
             LIMIT 1
            """)
    Prompt selectByTeamSlugAndSlug(@Param("teamSlug") String teamSlug,
                                   @Param("promptSlug") String promptSlug);

    @Update("UPDATE prompts SET exports = exports + 1, updated_at = NOW() WHERE id = #{id} AND deleted = 0")
    int incrExports(@Param("id") Long id);

    @Update("""
            UPDATE prompts p
               SET p.score = COALESCE(
                       (SELECT AVG(r.rating)
                          FROM asset_reviews r
                         WHERE r.target_type = 'PROMPT'
                           AND r.target_id = p.id
                           AND r.deleted = 0),
                       0
                   ),
                   p.updated_at = NOW()
             WHERE p.id = #{id} AND p.deleted = 0
            """)
    int recomputeScore(@Param("id") Long id);
}
