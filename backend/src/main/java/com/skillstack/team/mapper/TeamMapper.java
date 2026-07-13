package com.skillstack.team.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.common.storage.StorageUrlTypeHandler;
import com.skillstack.team.dto.MyTeamItem;
import com.skillstack.team.dto.TeamMemberRes;
import com.skillstack.team.entity.Team;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TeamMapper extends BaseMapper<Team> {

    /** 当前用户加入的所有团队 + 角色 + 未读数。对齐 MY_TEAMS。 */
    @Select("""
            SELECT t.id AS id,
                   t.slug AS slug,
                   t.name AS name,
                   t.avatar_char AS avatar,
                   t.logo_url AS logoUrl,
                   t.color AS color,
                   tm.role AS role,
                   t.members_count AS members,
                   COALESCE(ut.unread, 0) AS unread
            FROM teams t
            JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = #{userId} AND tm.deleted = 0
            LEFT JOIN user_team_unread ut ON ut.team_id = t.id AND ut.user_id = #{userId} AND ut.deleted = 0
            WHERE t.deleted = 0
            ORDER BY tm.joined_at ASC
            """)
    @Results({
            @Result(column = "logoUrl", property = "logoUrl",
                    typeHandler = StorageUrlTypeHandler.class),
    })
    List<MyTeamItem> selectMyTeams(@Param("userId") Long userId);

    /** 团队成员列表（含 user 基本信息），用于成员表 / 主要贡献者 */
    @Select({
            "<script>",
            "SELECT u.id AS userId,",
            "       u.handle AS handle,",
            "       u.name AS name,",
            "       u.avatar AS avatar,",
            "       COALESCE(u.avatar_url, u.feishu_avatar_url) AS avatarUrl,",
            "       tm.role AS role,",
            "       DATE_FORMAT(tm.joined_at, '%Y-%m-%d') AS joined,",
            // skills 字段由 Service 层用 SkillMapper.countByTeamAndAuthors 批量回填。
            // tm.skills_count 是历史冗余列，没有任何写路径维护，不能直接读。
            "       0 AS skills,",
            "       tm.last_active_label AS lastActive",
            "  FROM team_members tm",
            "  JOIN users u ON u.id = tm.user_id AND u.deleted = 0",
            " WHERE tm.team_id = #{teamId}",
            "   AND tm.deleted = 0",
            "   <if test='role != null and role != \"\"'> AND tm.role = #{role} </if>",
            "   <if test='q != null and q != \"\"'> AND (u.name LIKE CONCAT('%', #{q}, '%') OR u.handle LIKE CONCAT('%', #{q}, '%')) </if>",
            " ORDER BY FIELD(tm.role, 'OWNER','ADMIN','MEMBER','VIEWER'), tm.joined_at ASC",
            " LIMIT #{offset}, #{size}",
            "</script>"
    })
    @Results({
            @Result(column = "avatarUrl", property = "avatarUrl",
                    typeHandler = StorageUrlTypeHandler.class),
    })
    List<TeamMemberRes> selectMembers(@Param("teamId") Long teamId,
                                      @Param("role") String role,
                                      @Param("q") String q,
                                      @Param("offset") long offset,
                                      @Param("size") long size);

    @Select({
            "<script>",
            "SELECT COUNT(*) FROM team_members tm JOIN users u ON u.id = tm.user_id AND u.deleted = 0",
            " WHERE tm.team_id = #{teamId} AND tm.deleted = 0",
            "   <if test='role != null and role != \"\"'> AND tm.role = #{role} </if>",
            "   <if test='q != null and q != \"\"'> AND (u.name LIKE CONCAT('%', #{q}, '%') OR u.handle LIKE CONCAT('%', #{q}, '%')) </if>",
            "</script>"
    })
    long countMembers(@Param("teamId") Long teamId,
                      @Param("role") String role,
                      @Param("q") String q);
}
