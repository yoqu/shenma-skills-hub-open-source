package com.skillstack.team.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.team.dto.InviteCodeRes;
import com.skillstack.team.entity.InviteCode;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface InviteCodeMapper extends BaseMapper<InviteCode> {

    @Select("""
            SELECT ic.id AS id,
                   ic.code AS code,
                   ic.used AS uses,
                   ic.max_uses AS max,
                   ic.expires_label AS expiresIn,
                   ic.role AS role,
                   CASE
                     WHEN ic.status = 'active'
                          AND ic.expires_at IS NOT NULL
                          AND ic.expires_at < NOW()
                     THEN 'expired'
                     ELSE ic.status
                   END AS status,
                   u.name AS createdBy,
                   DATE_FORMAT(ic.created_at, '%Y-%m-%d') AS createdAt
              FROM invites_code ic
              JOIN users u ON u.id = ic.created_by AND u.deleted = 0
             WHERE ic.team_id = #{teamId}
               AND ic.deleted = 0
             ORDER BY ic.created_at DESC
            """)
    List<InviteCodeRes> selectByTeam(@Param("teamId") Long teamId);

    /**
     * 原子地把邀请码的 used +1，仅当当前 used 严格小于 max_uses 且状态为 active 时成功。
     * 返回 affected rows（0 表示并发抢占失败 / 已 exhausted / 已 revoked / 已过期）。
     * 见 TEAM-INV-006。
     */
    @Update("""
            UPDATE invites_code
               SET used = used + 1
             WHERE id = #{id}
               AND deleted = 0
               AND status = 'active'
               AND used < max_uses
               AND (expires_at IS NULL OR expires_at > NOW())
            """)
    int incrementUsedIfAvailable(@Param("id") Long id);
}
