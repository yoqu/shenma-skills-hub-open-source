package com.skillstack.userskill.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.userskill.entity.UserSkill;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

@Mapper
public interface UserSkillMapper extends BaseMapper<UserSkill> {

    @Select("""
            SELECT us.id, us.user_id, us.source, us.skill_id, us.review_id,
                   us.slug, us.name, us.short_desc, us.cat_code, us.icon,
                   us.version,
                   CASE WHEN us.source IN ('TEAM', 'PUBLIC') THEN COALESCE(sv.zip_url, us.zip_url) ELSE us.zip_url END AS zip_url,
                   CASE WHEN us.source IN ('TEAM', 'PUBLIC') THEN COALESCE(sv.files_count, us.files_count) ELSE us.files_count END AS files_count,
                   us.safety, us.eval_score,
                   us.langs, us.created_at, us.updated_at,
                   s.version AS public_version,
                   s.status AS public_status,
                   s.visibility AS public_visibility,
                   s.deleted AS public_deleted,
                   s.installs AS public_installs,
                   s.stars AS public_stars,
                   COALESCE(u.id, owner.id) AS author_id,
                   COALESCE(u.name, owner.name) AS author_name,
                   COALESCE(u.handle, owner.handle) AS author_handle
              FROM user_skills us
              LEFT JOIN skills s ON s.id = us.skill_id
              LEFT JOIN users u ON u.id = s.author_id AND u.deleted = 0
              LEFT JOIN users owner ON owner.id = us.user_id AND owner.deleted = 0
              LEFT JOIN skill_versions sv ON sv.skill_id = s.id AND sv.version = s.version AND sv.deleted = 0
             WHERE us.deleted = 0
               AND us.user_id = #{userId}
             ORDER BY FIELD(us.source, 'PERSONAL', 'TEAM', 'PUBLIC'), us.updated_at DESC, us.id DESC
            """)
    List<Map<String, Object>> selectMineWithSkill(@Param("userId") Long userId);

    @Select("""
            SELECT id, user_id, source, skill_id, review_id, slug, name, short_desc,
                   cat_code, icon, version, zip_url, files_count, safety, eval_score,
                   langs, created_at, updated_at, deleted
              FROM user_skills
             WHERE user_id = #{userId}
               AND source = #{source}
               AND slug = #{slug}
             LIMIT 1
            """)
    UserSkill selectOneIncludeDeletedBySlug(@Param("userId") Long userId,
                                            @Param("source") String source,
                                            @Param("slug") String slug);

    @Select("""
            SELECT id, user_id, source, skill_id, review_id, slug, name, short_desc,
                   cat_code, icon, version, zip_url, files_count, safety, eval_score,
                   langs, created_at, updated_at, deleted
              FROM user_skills
             WHERE user_id = #{userId}
               AND skill_id = #{skillId}
             LIMIT 1
            """)
    UserSkill selectOneIncludeDeletedBySkillId(@Param("userId") Long userId,
                                               @Param("skillId") Long skillId);

    @Delete("DELETE FROM user_skills WHERE id = #{id}")
    int hardDeleteById(@Param("id") Long id);

    @Update("""
            UPDATE user_skills
               SET skill_id = #{skillId}, updated_at = NOW()
             WHERE review_id = #{reviewId}
               AND source = 'PERSONAL'
               AND deleted = 0
            """)
    int backfillSkillIdByReviewId(@Param("reviewId") Long reviewId,
                                  @Param("skillId") Long skillId);
}
