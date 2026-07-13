package com.skillstack.team.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.PermissionService;
import com.skillstack.common.storage.StorageService;
import com.skillstack.common.util.SlugPolicy;
import com.skillstack.skill.mapper.SkillMapper;
import com.skillstack.team.dto.MyTeamItem;
import com.skillstack.team.dto.TeamDetailRes;
import com.skillstack.team.dto.TeamSettingsReq;
import com.skillstack.team.entity.Team;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.team.mapper.TeamMemberMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TeamService {

    private static final Set<String> ROLES = Set.of("OWNER", "ADMIN", "MEMBER", "VIEWER");
    private static final Set<String> WRITE_ROLES = Set.of("OWNER", "ADMIN");

    private final TeamMapper teamMapper;
    private final TeamMemberMapper teamMemberMapper;
    private final SkillMapper skillMapper;
    private final StorageService storageService;
    private final com.skillstack.common.storage.StorageUrlResolver storageUrlResolver;
    private final PermissionService permissionService;

    public List<MyTeamItem> listMyTeams(Long userId) {
        // logoUrl 由 TeamMapper.selectMyTeams 上的 StorageUrlTypeHandler 自动解析，service 不再二次拼接。
        return teamMapper.selectMyTeams(userId);
    }

    /**
     * 首页公开团队列表 — 只包含开启了"公开主页"开关的团队（TEAM-SET-004 / SUITE-019）。
     */
    public List<TeamDetailRes> listPublicTeams() {
        // 静态 public_skills 列会漂移，排序与展示统一以 toDetail 的实时计数为准。
        return teamMapper.selectList(new LambdaQueryWrapper<Team>()
                        .eq(Team::getPublicHome, Boolean.TRUE))
                .stream()
                .map(this::toDetail)
                .sorted(Comparator.comparingInt(TeamDetailRes::getPublicSkills).reversed())
                .toList();
    }

    /**
     * 公开主页详情 — 未开启 publicHome 的团队对匿名/外部访客返回 404。
     */
    public TeamDetailRes getPublicBySlug(String slug) {
        Team t = teamMapper.selectOne(
                new LambdaQueryWrapper<Team>().eq(Team::getSlug, slug));
        if (t == null || !Boolean.TRUE.equals(t.getPublicHome())) {
            throw new BusinessException(40400, "团队不存在");
        }
        return toDetail(t);
    }

    /**
     * 仅按 slug 取团队，给登录态接口用（不做 publicHome 过滤，
     * 因为成员/管理员需要看到自己的私有团队）。
     */
    public TeamDetailRes getBySlug(String slug) {
        Team t = teamMapper.selectOne(
                new LambdaQueryWrapper<Team>().eq(Team::getSlug, slug));
        if (t == null) {
            throw new BusinessException(40400, "团队不存在");
        }
        return toDetail(t);
    }

    public TeamDetailRes getById(Long teamId) {
        Team t = requireTeam(teamId);
        return toDetail(t);
    }

    @Transactional
    public TeamDetailRes createTeam(Long userId, String name) {
        return createTeam(userId, name, null);
    }

    @Transactional
    public TeamDetailRes createTeam(Long userId, String name, String requestedSlug) {
        try {
            String slug = generateUniqueSlug(name, requestedSlug);

            Team team = new Team();
            team.setSlug(slug);
            team.setName(name);
            team.setMembersCount(1);
            team.setPublicSkills(0);
            team.setPrivateSkills(0);
            team.setSuitesCount(0);
            team.setReviewMode("REVIEW_REQUIRED");
            team.setPublicHome(Boolean.FALSE);
            teamMapper.insert(team);

            TeamMember owner = new TeamMember();
            owner.setTeamId(team.getId());
            owner.setUserId(userId);
            owner.setRole("OWNER");
            owner.setSkillsCount(0);
            owner.setJoinedAt(LocalDateTime.now());
            teamMemberMapper.insert(owner);

            return toDetail(team);
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException(40900, "团队标识已被占用，请重试");
        }
    }

    private String generateUniqueSlug(String name, String requestedSlug) {
        String manual = requestedSlug == null ? "" : requestedSlug.trim();
        String base = manual.isEmpty()
                ? SlugPolicy.normalize(name)
                : SlugPolicy.normalizeManual(manual, "团队英文标识");
        if (base.isEmpty()) {
            throw new BusinessException(40000, "请填写团队英文标识");
        }
        if (!manual.isEmpty() && base.length() > 64) {
            throw new BusinessException(40000, "团队英文标识最长 64 个字符");
        }
        if (manual.isEmpty() && base.length() > 56) {
            base = base.substring(0, 56).replaceAll("-+$", "");
        }

        String slug = base;
        int i = 1;
        while (teamMapper.selectCount(new LambdaQueryWrapper<Team>().eq(Team::getSlug, slug)) > 0) {
            if (!manual.isEmpty()) {
                throw new BusinessException(40900, "团队英文标识已被占用，请更换");
            }
            slug = base + "-" + i++;
        }
        return slug;
    }

    public TeamDetailRes updateSettings(Long teamId, Long userId, TeamSettingsReq req) {
        requireWriter(teamId, userId);
        Team t = requireTeam(teamId);
        if (StringUtils.hasText(req.getName())) t.setName(req.getName());
        if (req.getDescription() != null) t.setDescription(req.getDescription());
        if (StringUtils.hasText(req.getAvatarChar())) t.setAvatarChar(req.getAvatarChar());
        if (StringUtils.hasText(req.getColor())) t.setColor(req.getColor());
        if (StringUtils.hasText(req.getReviewMode())) {
            String mode = req.getReviewMode();
            if (!"REVIEW_REQUIRED".equals(mode) && !"DIRECT_PUBLISH".equals(mode)) {
                throw new BusinessException(40000, "reviewMode 必须是 REVIEW_REQUIRED 或 DIRECT_PUBLISH");
            }
            t.setReviewMode(mode);
        }
        if (req.getPublicHome() != null) t.setPublicHome(req.getPublicHome());
        teamMapper.updateById(t);
        return toDetail(t);
    }

    public String uploadLogo(Long teamId, Long userId, MultipartFile file) {
        requireWriter(teamId, userId);
        if (file == null || file.isEmpty()) {
            throw new BusinessException(40001, "请选择要上传的图片");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new BusinessException(40002, "仅支持 JPG / PNG / GIF / WebP / SVG");
        }
        if (file.getSize() > 2L * 1024 * 1024) {
            throw new BusinessException(40003, "图片大小不能超过 2MB");
        }

        Team team = requireTeam(teamId);
        if (team.getLogoUrl() != null) {
            storageService.delete(team.getLogoUrl());
        }

        String key;
        try {
            key = storageService.store(file, "teams/" + teamId + "/logo");
        } catch (IOException e) {
            throw new BusinessException(50001, "团队 Logo 上传失败，请重试");
        }

        Team update = new Team();
        update.setId(teamId);
        update.setLogoUrl(key);
        teamMapper.updateById(update);
        return storageService.resolveUrl(key);
    }

    public Team requireTeam(Long teamId) {
        Team t = teamMapper.selectById(teamId);
        if (t == null) {
            throw new BusinessException(40400, "团队不存在");
        }
        return t;
    }

    /**
     * 当前用户在团队中的成员记录，找不到抛 T_FORBIDDEN。
     *
     * <p>{@code SUPER_ADMIN} 视为合成 ADMIN 成员。</p>
     */
    public TeamMember requireMembership(Long teamId, Long userId) {
        if (permissionService != null && permissionService.isSuperAdmin(userId)) {
            return PermissionService.virtualSuperAdmin(teamId, userId);
        }
        TeamMember m = teamMemberMapper.selectOne(new LambdaQueryWrapper<TeamMember>()
                .eq(TeamMember::getTeamId, teamId)
                .eq(TeamMember::getUserId, userId));
        if (m == null) {
            throw new BusinessException(40300, "T_FORBIDDEN: 你不是该团队成员");
        }
        return m;
    }

    /**
     * 写操作权限：OWNER / ADMIN。
     *
     * <p>{@code SUPER_ADMIN} 视为合成 ADMIN 成员。</p>
     */
    public TeamMember requireWriter(Long teamId, Long userId) {
        if (permissionService != null && permissionService.isSuperAdmin(userId)) {
            return PermissionService.virtualSuperAdmin(teamId, userId);
        }
        TeamMember m = requireMembership(teamId, userId);
        if (!WRITE_ROLES.contains(m.getRole())) {
            throw new BusinessException(40300, "T_FORBIDDEN: 需要 ADMIN 或 OWNER 角色");
        }
        return m;
    }

    public static boolean isValidRole(String role) {
        return role != null && ROLES.contains(role);
    }

    private TeamDetailRes toDetail(Team t) {
        TeamDetailRes res = new TeamDetailRes();
        res.setId(t.getId());
        res.setSlug(t.getSlug());
        res.setName(t.getName());
        res.setDescription(t.getDescription());
        res.setAvatar(t.getAvatarChar());
        res.setLogoUrl(storageUrlResolver.resolveSingle(t.getLogoUrl()));
        res.setColor(t.getColor());
        res.setMembers(liveMemberCount(t.getId()));
        int[] skillCounts = liveSkillCounts(t.getId());
        res.setPublicSkills(skillCounts[0]);
        res.setPrivateSkills(skillCounts[1]);
        res.setSuites(t.getSuitesCount());
        res.setReviewMode(t.getReviewMode() == null ? "REVIEW_REQUIRED" : t.getReviewMode());
        res.setPublicHome(t.getPublicHome() == null ? Boolean.TRUE : t.getPublicHome());
        res.setCreatedAt(t.getCreatedAt());
        return res;
    }

    /**
     * 实时统计团队成员数（替代 teams.members_count 静态列）。
     * 静态列存在 seed 漂移、并发增减漏算等问题，统一以 team_members 实时计数为准。
     * BaseMapper.selectCount 自动带上逻辑删除条件（deleted = 0）。
     */
    private int liveMemberCount(Long teamId) {
        if (teamId == null) return 0;
        Long n = teamMemberMapper.selectCount(
                new LambdaQueryWrapper<TeamMember>().eq(TeamMember::getTeamId, teamId));
        return n == null ? 0 : n.intValue();
    }

    /**
     * 实时统计团队 Skill 数（替代 teams.public_skills / private_skills 的静态列）。
     * 返回 [public, private]。静态列不会随 skill 增删自动更新，因此侧边栏与详情页统一走该方法。
     */
    private int[] liveSkillCounts(Long teamId) {
        int pub = 0;
        int priv = 0;
        if (teamId != null) {
            for (Map<String, Object> r : skillMapper.countByTeamGroupByVisibility(teamId)) {
                String v = (String) r.get("visibility");
                Object c = r.get("cnt");
                int n = c instanceof Number ? ((Number) c).intValue() : 0;
                if ("PUBLIC".equals(v)) pub = n;
                else if ("TEAM_PRIVATE".equals(v)) priv = n;
            }
        }
        return new int[] { pub, priv };
    }
}
