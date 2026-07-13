package com.skillstack.team.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.storage.StorageUrlResolver;
import com.skillstack.team.dto.TeamMemberProfileRes;
import com.skillstack.team.dto.UpdateTeamMemberProfileReq;
import com.skillstack.team.entity.TeamMemberProfile;
import com.skillstack.team.mapper.TeamMemberProfileMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TeamMemberProfileService {

    private final TeamMemberProfileMapper mapper;
    private final UserMapper userMapper;
    private final TeamAccessGuard guard;
    private final StorageUrlResolver storageUrlResolver;

    public TeamMemberProfileRes get(Long teamId, Long targetUserId, Long viewerId) {
        guard.requireMember(teamId, viewerId);
        guard.requireMember(teamId, targetUserId);
        User u = userMapper.selectById(targetUserId);
        TeamMemberProfile p = findRow(teamId, targetUserId);
        boolean self = viewerId.equals(targetUserId);
        boolean writer = guard.isWriter(teamId, viewerId);
        boolean showEmail = p != null && Boolean.TRUE.equals(p.getShowEmail());
        return TeamMemberProfileRes.builder()
                .displayName(p != null && p.getDisplayName() != null ? p.getDisplayName() : u.getName())
                .bio(p != null && p.getBio() != null ? p.getBio() : u.getBio())
                .showEmail(p != null && Boolean.TRUE.equals(p.getShowEmail()))
                .email(self || writer || showEmail ? u.getEmail() : null)
                .avatarUrl(storageUrlResolver.resolve(u.getAvatarUrl(), u.getFeishuAvatarUrl()))
                .handle(u.getHandle())
                .build();
    }

    @Transactional
    public TeamMemberProfileRes update(Long teamId, Long userId, UpdateTeamMemberProfileReq req) {
        guard.requireMember(teamId, userId);
        TeamMemberProfile p = findRow(teamId, userId);
        if (p == null) {
            p = new TeamMemberProfile();
            p.setTeamId(teamId);
            p.setUserId(userId);
            p.setDisplayName(req.getDisplayName().trim());
            p.setBio(blankToNull(req.getBio()));
            p.setShowEmail(Boolean.TRUE.equals(req.getShowEmail()));
            mapper.insert(p);
        } else {
            String newBio = blankToNull(req.getBio());
            mapper.update(null, new LambdaUpdateWrapper<TeamMemberProfile>()
                    .eq(TeamMemberProfile::getId, p.getId())
                    .set(TeamMemberProfile::getDisplayName, req.getDisplayName().trim())
                    .set(TeamMemberProfile::getBio, newBio)
                    .set(TeamMemberProfile::getShowEmail, Boolean.TRUE.equals(req.getShowEmail())));
        }
        return get(teamId, userId, userId);
    }

    private TeamMemberProfile findRow(Long teamId, Long userId) {
        return mapper.selectOne(new LambdaQueryWrapper<TeamMemberProfile>()
                .eq(TeamMemberProfile::getTeamId, teamId)
                .eq(TeamMemberProfile::getUserId, userId));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
