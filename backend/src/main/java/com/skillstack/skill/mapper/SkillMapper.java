package com.skillstack.skill.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.skill.entity.Skill;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

/**
 * Skill 自定义查询：公开广场固定读取 PUBLIC + APPROVED；团队 Skill 库使用可筛选列表。
 *
 * 返回 Map<String, Object> 而非 DTO，service 层负责拼装 tags / langs JSON。
 */
@Mapper
public interface SkillMapper extends BaseMapper<Skill> {

    @Select("""
            SELECT s.id, s.slug, s.name, s.short_desc, s.cat_code, s.icon, s.icon_url, s.version,
                   s.visibility, s.status, s.installs, s.stars, s.score,
                   s.safety, s.eval_score, s.langs, s.published_at, s.author_id, s.team_id,
                   u.name AS author_name, u.handle AS author_handle,
                   t.slug AS team_slug
              FROM skills s
              LEFT JOIN users u ON u.id = s.author_id AND u.deleted = 0
              LEFT JOIN teams t ON t.id = s.team_id AND t.deleted = 0
             WHERE s.deleted = 0
               AND s.visibility = 'PUBLIC'
               AND s.status = 'APPROVED'
             ORDER BY s.published_at DESC, s.id DESC
             LIMIT #{offset}, #{size}
            """)
    List<Map<String, Object>> selectPublicSkills(@Param("offset") long offset,
                                                 @Param("size") long size);

    @Select("""
            SELECT COUNT(*)
              FROM skills s
             WHERE s.deleted = 0
               AND s.visibility = 'PUBLIC'
               AND s.status = 'APPROVED'
            """)
    long countPublicSkills();

    /**
     * 团队 Skill 库列表查询。
     * cat=null/"all" 表示不过滤分类。
     * sort: hot(installs)/recent(published_at)/score
     */
    @Select({
            "<script>",
            "SELECT s.id, s.slug, s.name, s.short_desc, s.cat_code, s.icon, s.icon_url, s.version,",
            "       s.visibility, s.status, s.installs, s.stars, s.score,",
            "       s.safety, s.eval_score, s.langs, s.published_at, s.updated_at, s.author_id, s.team_id,",
            "       u.name AS author_name, u.handle AS author_handle,",
            "       t.slug AS team_slug",
            "  FROM skills s",
            "  LEFT JOIN users u ON u.id = s.author_id AND u.deleted = 0",
            "  LEFT JOIN teams t ON t.id = s.team_id AND t.deleted = 0",
            " WHERE s.deleted = 0",
            "   <if test='cat != null and cat != \"\" and cat != \"all\"'> AND s.cat_code = #{cat} </if>",
            "   <if test='visibility != null and visibility != \"\"'> AND s.visibility = #{visibility} </if>",
            "   <if test='status != null and status != \"\"'> AND s.status = #{status} </if>",
            "   <if test='safety != null and safety != \"\"'> AND s.safety = #{safety} </if>",
            "   <if test='teamId != null'> AND s.team_id = #{teamId} </if>",
            "   <if test='authorId != null'> AND s.author_id = #{authorId} </if>",
            "   <if test='updatedWithin != null and updatedWithin > 0'>",
            "      AND s.updated_at >= DATE_SUB(NOW(), INTERVAL #{updatedWithin} DAY)",
            "   </if>",
            "   <if test='q != null and q != \"\"'>",
            "      AND (s.name LIKE CONCAT('%', #{q}, '%')",
            "        OR s.slug LIKE CONCAT('%', #{q}, '%')",
            "        OR s.short_desc LIKE CONCAT('%', #{q}, '%'))",
            "   </if>",
            " ORDER BY",
            "   <choose>",
            "     <when test='sort == \"recent\"'> s.published_at DESC, s.id DESC </when>",
            "     <when test='sort == \"score\"'>  s.score DESC, s.installs DESC </when>",
            "     <otherwise> s.installs DESC, s.id DESC </otherwise>",
            "   </choose>",
            " LIMIT #{offset}, #{size}",
            "</script>"
    })
    List<Map<String, Object>> selectPlaza(@Param("cat") String cat,
                                          @Param("q") String q,
                                          @Param("sort") String sort,
                                          @Param("safety") String safety,
                                          @Param("visibility") String visibility,
                                          @Param("status") String status,
                                          @Param("teamId") Long teamId,
                                          @Param("authorId") Long authorId,
                                          @Param("updatedWithin") Integer updatedWithin,
                                          @Param("offset") long offset,
                                          @Param("size") long size);

    @Select({
            "<script>",
            "SELECT COUNT(*) FROM skills s WHERE s.deleted = 0",
            "   <if test='cat != null and cat != \"\" and cat != \"all\"'> AND s.cat_code = #{cat} </if>",
            "   <if test='visibility != null and visibility != \"\"'> AND s.visibility = #{visibility} </if>",
            "   <if test='status != null and status != \"\"'> AND s.status = #{status} </if>",
            "   <if test='safety != null and safety != \"\"'> AND s.safety = #{safety} </if>",
            "   <if test='teamId != null'> AND s.team_id = #{teamId} </if>",
            "   <if test='authorId != null'> AND s.author_id = #{authorId} </if>",
            "   <if test='updatedWithin != null and updatedWithin > 0'>",
            "      AND s.updated_at >= DATE_SUB(NOW(), INTERVAL #{updatedWithin} DAY)",
            "   </if>",
            "   <if test='q != null and q != \"\"'>",
            "      AND (s.name LIKE CONCAT('%', #{q}, '%')",
            "        OR s.slug LIKE CONCAT('%', #{q}, '%')",
            "        OR s.short_desc LIKE CONCAT('%', #{q}, '%'))",
            "   </if>",
            "</script>"
    })
    long countPlaza(@Param("cat") String cat,
                    @Param("q") String q,
                    @Param("safety") String safety,
                    @Param("visibility") String visibility,
                    @Param("status") String status,
                    @Param("teamId") Long teamId,
                    @Param("authorId") Long authorId,
                    @Param("updatedWithin") Integer updatedWithin);

    /** 详情：连 user / team / category 一起拉出来，service 层再拼 tags */
    @Select("""
            SELECT s.id, s.slug, s.name, s.short_desc, s.description_md, s.cat_code, s.icon, s.icon_url, s.version,
                   s.visibility, s.status, s.installs, s.stars, s.score,
                   s.safety, s.eval_score, s.langs, s.published_at, s.updated_at,
                   s.author_id, s.team_id,
                   u.name AS author_name, u.handle AS author_handle,
                   t.slug AS team_slug, t.name AS team_name,
                   t.avatar_char AS team_avatar, t.color AS team_color,
                   t.members_count AS team_members, t.public_skills AS team_public_skills,
                   c.name AS cat_name
              FROM skills s
              LEFT JOIN users u ON u.id = s.author_id AND u.deleted = 0
              LEFT JOIN teams t ON t.id = s.team_id AND t.deleted = 0
              LEFT JOIN categories c ON c.code = s.cat_code AND c.deleted = 0
             WHERE s.deleted = 0
               AND s.slug = #{slug}
             LIMIT 1
            """)
    Map<String, Object> selectDetailBySlug(@Param("slug") String slug);

    /** 自增 installs，原子操作 */
    @Update("UPDATE skills SET installs = installs + 1, updated_at = NOW() WHERE id = #{id} AND deleted = 0")
    int incrInstalls(@Param("id") Long id);

    @Update("UPDATE skills SET stars = stars + #{delta}, updated_at = NOW() WHERE id = #{id} AND deleted = 0")
    int incrStars(@Param("id") Long id, @Param("delta") int delta);

    /**
     * 用 skill_reviews 表的 AVG(rating) 重新写回 skills.score。
     * 无评论时回到 0.00。score 列定义为 DECIMAL(3,2)，AVG 自动收敛到该精度。
     */
    @Update("""
            UPDATE skills s
               SET s.score = COALESCE(
                       (SELECT AVG(r.rating) FROM skill_reviews r WHERE r.skill_id = s.id AND r.deleted = 0),
                       0
                   ),
                   s.updated_at = NOW()
             WHERE s.id = #{id} AND s.deleted = 0
            """)
    int recomputeScore(@Param("id") Long id);

    @Select("""
            SELECT s.id, s.slug, s.name, s.short_desc, s.cat_code, s.icon, s.icon_url, s.version,
                   s.visibility, s.status, s.installs, s.stars, s.score, s.safety,
                   s.eval_score, s.langs, s.published_at, s.author_id, s.team_id,
                   u.name AS author_name, u.handle AS author_handle,
                   t.slug AS team_slug
              FROM skills s
              LEFT JOIN users u ON u.id = s.author_id AND u.deleted = 0
              LEFT JOIN teams t ON t.id = s.team_id AND t.deleted = 0
             WHERE s.deleted = 0
               AND s.author_id = #{userId}
               AND s.status = 'DRAFT'
             ORDER BY s.updated_at DESC
            """)
    List<Map<String, Object>> selectDraftsByUser(@Param("userId") Long userId);

    /**
     * 团队 Skill 库实时统计（按 visibility 分组），用于侧边栏与团队详情。
     * 只统计未删除的 skill，包含所有状态。
     */
    @Select("""
            SELECT s.visibility AS visibility, COUNT(*) AS cnt
              FROM skills s
             WHERE s.deleted = 0
               AND s.team_id = #{teamId}
             GROUP BY s.visibility
            """)
    List<Map<String, Object>> countByTeamGroupByVisibility(@Param("teamId") Long teamId);

    /**
     * 团队内按作者批量统计 skill 数，供成员列表展示用。
     * 返回行：{ authorId: Long, cnt: Long }，调用方按 authorId 回填。
     */
    @Select({
            "<script>",
            "SELECT s.author_id AS authorId, COUNT(*) AS cnt",
            "  FROM skills s",
            " WHERE s.deleted = 0",
            "   AND s.team_id = #{teamId}",
            "   AND s.author_id IN",
            "   <foreach collection='authorIds' item='id' open='(' separator=',' close=')'>",
            "       #{id}",
            "   </foreach>",
            " GROUP BY s.author_id",
            "</script>"
    })
    List<Map<String, Object>> countByTeamAndAuthors(@Param("teamId") Long teamId,
                                                    @Param("authorIds") List<Long> authorIds);

    /**
     * 查找同 slug、已 soft-delete 且从未发布过的 skill 行 id。
     *
     * <p>背景：{@code uk_skills_slug} 是仅基于 slug 的唯一索引（未含 deleted），
     * MyBatis Plus 的 {@code selectCount} 会自动过滤 deleted=0，所以业务校验看不到
     * 这些行，但 MySQL 仍然把它们计入唯一约束。V17 迁移把所有未发布 skill 行
     * 批量 soft-delete，留下的 slug 占位会让后续同 slug 的 review 物化失败。</p>
     *
     * <p>只回收 status NOT IN ('APPROVED','UNLISTED') 的行，避免误删历史已发布资产。</p>
     */
    @Select("SELECT id FROM skills WHERE slug = #{slug} AND deleted = 1 "
            + "AND status NOT IN ('APPROVED','UNLISTED')")
    List<Long> findPurgeableSoftDeletedIdsBySlug(@Param("slug") String slug);

    @Delete({"<script>",
            "DELETE FROM skill_versions WHERE skill_id IN ",
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
            "</script>"})
    int hardDeleteVersionsBySkillIds(@Param("ids") List<Long> ids);

    @Delete({"<script>",
            "DELETE FROM skill_tags WHERE skill_id IN ",
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
            "</script>"})
    int hardDeleteTagsBySkillIds(@Param("ids") List<Long> ids);

    @Delete({"<script>",
            "DELETE FROM skills WHERE id IN ",
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
            "</script>"})
    int hardDeleteSkillsByIds(@Param("ids") List<Long> ids);
}
