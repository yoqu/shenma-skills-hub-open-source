package com.skillstack.review.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.common.storage.StorageUrlTypeHandler;
import com.skillstack.review.dto.ReviewListItem;
import com.skillstack.review.entity.Review;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface ReviewMapper extends BaseMapper<Review> {

    /** 团队审核队列：按提交时间倒序，可选 status 过滤。 */
    @Select({
            "<script>",
            "SELECT r.code AS id,",
            "       r.id AS rowId,",
            "       r.target_type AS targetType,",
            "       r.target_id AS targetId,",
            "       r.skill_id AS skillId,",
            "       COALESCE(r.display_slug, r.skill_slug) AS slug,",
            "       COALESCE(r.display_name, r.skill_name) AS name,",
            "       r.short_desc AS shortDesc,",
            "       r.visibility AS visibility,",
            "       r.files_count AS files,",
            "       r.version AS version,",
            "       r.safety AS safety,",
            "       r.eval_score AS evalScore,",
            "       r.status AS status,",
            "       r.reason AS reason,",
            "       r.changelog AS changelog,",
            "       r.kind AS kind,",
            "       r.cat_code AS catCode,",
            "       r.icon AS icon,",
            "       r.langs_json AS langsJson,",
            "       r.tags_json AS tagsJson,",
            "       DATE_FORMAT(r.submitted_at, '%Y-%m-%d %H:%i') AS submittedAt,",
            "       u.id AS submitter_id,",
            "       u.handle AS submitter_handle,",
            "       u.name AS submitter_name,",
            "       u.avatar AS submitter_avatar,",
            "       COALESCE(u.avatar_url, u.feishu_avatar_url) AS submitter_avatar_url",
            "  FROM reviews r",
            "  JOIN users u ON u.id = r.submitter_id AND u.deleted = 0",
            " WHERE r.team_id = #{teamId}",
            "   AND r.deleted = 0",
            "   <if test='status != null and status != \"\"'> AND r.status = #{status} </if>",
            "   <if test='targetType != null and targetType != \"\"'> AND r.target_type = #{targetType} </if>",
            " ORDER BY r.submitted_at DESC",
            " LIMIT #{offset}, #{size}",
            "</script>"
    })
    @Results({
            @Result(column = "id", property = "id"),
            @Result(column = "rowId", property = "rowId"),
            @Result(column = "targetType", property = "targetType"),
            @Result(column = "targetId", property = "targetId"),
            @Result(column = "skillId", property = "skillId"),
            @Result(column = "slug", property = "slug"),
            @Result(column = "name", property = "name"),
            @Result(column = "shortDesc", property = "shortDesc"),
            @Result(column = "visibility", property = "visibility"),
            @Result(column = "files", property = "files"),
            @Result(column = "version", property = "version"),
            @Result(column = "safety", property = "safety"),
            @Result(column = "evalScore", property = "evalScore"),
            @Result(column = "status", property = "status"),
            @Result(column = "reason", property = "reason"),
            @Result(column = "changelog", property = "changelog"),
            @Result(column = "kind", property = "kind"),
            @Result(column = "catCode", property = "catCode"),
            @Result(column = "icon", property = "icon"),
            @Result(column = "langsJson", property = "langsJson"),
            @Result(column = "tagsJson", property = "tagsJson"),
            @Result(column = "submittedAt", property = "submittedAt"),
            @Result(column = "submitter_id", property = "submittedBy.id"),
            @Result(column = "submitter_handle", property = "submittedBy.handle"),
            @Result(column = "submitter_name", property = "submittedBy.name"),
            @Result(column = "submitter_avatar", property = "submittedBy.avatar"),
            @Result(column = "submitter_avatar_url", property = "submittedBy.avatarUrl",
                    typeHandler = StorageUrlTypeHandler.class),
    })
    List<ReviewListItem> selectList(@Param("teamId") Long teamId,
                                    @Param("status") String status,
                                    @Param("targetType") String targetType,
                                    @Param("offset") long offset,
                                    @Param("size") long size);

    @Select({
            "<script>",
            "SELECT COUNT(*) FROM reviews r",
            " WHERE r.team_id = #{teamId} AND r.deleted = 0",
            "   <if test='status != null and status != \"\"'> AND r.status = #{status} </if>",
            "   <if test='targetType != null and targetType != \"\"'> AND r.target_type = #{targetType} </if>",
            "</script>"
    })
    long countList(@Param("teamId") Long teamId,
                   @Param("status") String status,
                   @Param("targetType") String targetType);

    /** 直接更新关联 skill 的 status（审批联动），避开跨模块 mapper 依赖。 */
    @Update({
            "<script>",
            "UPDATE skills SET status = #{status}",
            "<if test='publish'> , published_at = NOW() </if>",
            " WHERE id = #{skillId} AND deleted = 0",
            "</script>"
    })
    int updateSkillStatus(@Param("skillId") Long skillId,
                          @Param("status") String status,
                          @Param("publish") boolean publish);

    /** 审批通过时把 skill.version 同步到本次审核的版本号（SKILL-VER-001）。 */
    @Update("UPDATE skills SET version = #{version} WHERE id = #{skillId} AND deleted = 0")
    int updateSkillVersion(@Param("skillId") Long skillId, @Param("version") String version);

    /** 当前 skill.version（用于决定 approve 时是否需要写 skill_versions 历史）。 */
    @Select("SELECT version FROM skills WHERE id = #{skillId} AND deleted = 0")
    String findSkillVersion(@Param("skillId") Long skillId);

    /** 写 skill_versions 历史行（审批通过时记录新版本发布）。 */
    @Update("INSERT INTO skill_versions(skill_id, version, changelog, zip_url, files_count, safety, eval_score, published_at, created_at, updated_at) "
            + "VALUES (#{skillId}, #{version}, #{changelog}, #{zipUrl}, #{filesCount}, #{safety}, #{evalScore}, NOW(), NOW(), NOW())")
    int insertSkillVersion(@Param("skillId") Long skillId,
                           @Param("version") String version,
                           @Param("changelog") String changelog,
                           @Param("zipUrl") String zipUrl,
                           @Param("filesCount") Integer filesCount,
                           @Param("safety") String safety,
                           @Param("evalScore") Integer evalScore);

    /** 统计某 skill 当前是否有未决审核（PENDING_REVIEW / CHANGES_REQUESTED）。 */
    @Select("SELECT COUNT(*) FROM reviews WHERE skill_id = #{skillId} "
            + "AND status IN ('PENDING_REVIEW','CHANGES_REQUESTED') AND deleted = 0")
    long countOpenBySkill(@Param("skillId") Long skillId);

    /** 用 skill_slug 反查 skill_id（待建档审核场景下 reviews.skill_id 可能为 NULL）。 */
    @Select("SELECT id FROM skills WHERE slug = #{slug} AND deleted = 0 LIMIT 1")
    Long findSkillIdBySlug(@Param("slug") String slug);

    /**
     * Review-first 提交流程中，submitter 自己的草稿列表（kind='CREATE' AND status='DRAFT'）。
     * 返回字段命名兼容 SkillCard 转换需要的列。
     */
    @Select("""
            SELECT r.id, r.skill_slug AS slug, r.skill_name AS name, r.short_desc,
                   r.cat_code, r.icon, r.icon_url, r.version, r.visibility, 'DRAFT' AS status,
                   0 AS installs, 0 AS stars, 0.0 AS score,
                   r.safety, r.eval_score, r.langs_json AS langs,
                   r.submitted_at AS published_at, r.updated_at,
                   r.submitter_id AS author_id, r.team_id, r.tags_json,
                   u.name AS author_name, u.handle AS author_handle,
                   t.slug AS team_slug
              FROM reviews r
              LEFT JOIN users u ON u.id = r.submitter_id AND u.deleted = 0
              LEFT JOIN teams t ON t.id = r.team_id AND t.deleted = 0
             WHERE r.deleted = 0
               AND r.submitter_id = #{userId}
               AND r.kind = 'CREATE'
               AND r.status = 'DRAFT'
             ORDER BY r.updated_at DESC
            """)
    java.util.List<java.util.Map<String, Object>> selectDraftsBySubmitter(@Param("userId") Long userId);

    /**
     * Slug 唯一性检查：开放期 reviews 中 (kind='CREATE' AND status IN open) 是否已占用。
     */
    /** 强制清空 review 的审阅反馈字段（reason / reviewer_id / decided_at），适用于 resubmit / submit。 */
    @Update("UPDATE reviews SET reason = NULL, reviewer_id = NULL, decided_at = NULL "
            + " WHERE id = #{id} AND deleted = 0")
    int clearDecision(@Param("id") Long id);

    @Select({
            "<script>",
            "SELECT COUNT(*) FROM reviews",
            " WHERE deleted = 0",
            "   AND kind = 'CREATE'",
            "   AND skill_slug = #{slug}",
            "   AND status IN ('DRAFT','PENDING_REVIEW','CHANGES_REQUESTED')",
            "   <if test='excludeId != null'> AND id &lt;&gt; #{excludeId} </if>",
            "</script>"
    })
    long countOpenReviewBySlug(@Param("slug") String slug, @Param("excludeId") Long excludeId);

    @Select({
            "<script>",
            "SELECT COUNT(*) FROM reviews",
            " WHERE deleted = 0",
            "   AND target_type = 'PROMPT'",
            "   AND kind = 'CREATE'",
            "   AND team_id = #{teamId}",
            "   AND COALESCE(display_slug, skill_slug) = #{slug}",
            "   AND status IN ('DRAFT','PENDING_REVIEW','CHANGES_REQUESTED')",
            "   <if test='excludeId != null'> AND id &lt;&gt; #{excludeId} </if>",
            "</script>"
    })
    long countOpenPromptReviewByTeamAndSlug(@Param("teamId") Long teamId,
                                            @Param("slug") String slug,
                                            @Param("excludeId") Long excludeId);
}
