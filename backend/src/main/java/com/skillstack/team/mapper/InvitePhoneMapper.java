package com.skillstack.team.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.team.dto.MyPhoneInviteRes;
import com.skillstack.team.dto.PhoneInviteRes;
import com.skillstack.team.entity.InvitePhone;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface InvitePhoneMapper extends BaseMapper<InvitePhone> {

    @Select("""
            SELECT ip.id AS id,
                   ip.phone_masked AS phone,
                   u.name AS invitedBy,
                   CASE
                     WHEN TIMESTAMPDIFF(MINUTE, ip.created_at, NOW()) < 60
                          THEN CONCAT(TIMESTAMPDIFF(MINUTE, ip.created_at, NOW()), ' 分钟前')
                     WHEN TIMESTAMPDIFF(HOUR, ip.created_at, NOW()) < 24
                          THEN CONCAT(TIMESTAMPDIFF(HOUR, ip.created_at, NOW()), ' 小时前')
                     WHEN TIMESTAMPDIFF(DAY, ip.created_at, NOW()) < 7
                          THEN CONCAT(TIMESTAMPDIFF(DAY, ip.created_at, NOW()), ' 天前')
                     ELSE DATE_FORMAT(ip.created_at, '%m-%d')
                   END AS at,
                   ip.note AS note,
                   ip.status AS status
              FROM invites_phone ip
              JOIN users u ON u.id = ip.invited_by AND u.deleted = 0
             WHERE ip.team_id = #{teamId}
               AND ip.deleted = 0
             ORDER BY ip.created_at DESC
            """)
    List<PhoneInviteRes> selectByTeam(@Param("teamId") Long teamId);

    @Select("""
            SELECT ip.id AS id,
                   ip.team_id AS teamId,
                   t.name AS teamName,
                   t.slug AS teamSlug,
                   u.name AS invitedBy,
                   ip.note AS note,
                   CASE
                     WHEN TIMESTAMPDIFF(MINUTE, ip.created_at, NOW()) < 60
                          THEN CONCAT(TIMESTAMPDIFF(MINUTE, ip.created_at, NOW()), ' 分钟前')
                     WHEN TIMESTAMPDIFF(HOUR, ip.created_at, NOW()) < 24
                          THEN CONCAT(TIMESTAMPDIFF(HOUR, ip.created_at, NOW()), ' 小时前')
                     WHEN TIMESTAMPDIFF(DAY, ip.created_at, NOW()) < 7
                          THEN CONCAT(TIMESTAMPDIFF(DAY, ip.created_at, NOW()), ' 天前')
                     ELSE DATE_FORMAT(ip.created_at, '%m-%d')
                   END AS at
              FROM invites_phone ip
              JOIN teams t ON t.id = ip.team_id AND t.deleted = 0
              JOIN users u ON u.id = ip.invited_by AND u.deleted = 0
             WHERE ip.phone_raw = #{phone}
               AND ip.status = 'pending'
               AND ip.deleted = 0
             ORDER BY ip.created_at DESC
            """)
    List<MyPhoneInviteRes> selectPendingByPhone(@Param("phone") String phone);
}
