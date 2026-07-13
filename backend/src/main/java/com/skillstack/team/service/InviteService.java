package com.skillstack.team.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.notification.service.NotificationService;
import com.skillstack.notification.service.NotificationType;
import com.skillstack.team.dto.CreateCodeReq;
import com.skillstack.team.dto.CreatePhoneInviteReq;
import com.skillstack.team.dto.InviteCodeRes;
import com.skillstack.team.dto.MyPhoneInviteRes;
import com.skillstack.team.dto.PhoneInviteRes;
import com.skillstack.team.entity.InviteCode;
import com.skillstack.team.entity.InvitePhone;
import com.skillstack.team.entity.Team;
import com.skillstack.team.mapper.InviteCodeMapper;
import com.skillstack.team.mapper.InvitePhoneMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class InviteService {

    private static final Set<String> CODE_ROLES = Set.of("ADMIN", "MEMBER", "VIEWER");
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final InviteCodeMapper inviteCodeMapper;
    private final InvitePhoneMapper invitePhoneMapper;
    private final UserMapper userMapper;
    private final TeamService teamService;
    private final TeamMemberService teamMemberService;
    private final NotificationService notificationService;

    // ---------------- 邀请码 ----------------

    public List<InviteCodeRes> listCodes(Long teamId, Long operatorId) {
        teamService.requireWriter(teamId, operatorId);
        return inviteCodeMapper.selectByTeam(teamId);
    }

    @Transactional
    public InviteCode createCode(Long teamId, Long operatorId, CreateCodeReq req) {
        teamService.requireWriter(teamId, operatorId);
        String role = req.getRole() == null ? "MEMBER" : req.getRole().toUpperCase();
        if (!CODE_ROLES.contains(role)) {
            throw new BusinessException(40001, "邀请码角色非法：" + role);
        }
        InviteCode code = new InviteCode();
        code.setTeamId(teamId);
        code.setCode(genCode());
        code.setMaxUses(req.getMax());
        code.setUsed(0);
        code.setRole(role);
        code.setExpiresAt(LocalDateTime.now().plusDays(req.getExpiresInDays()));
        code.setExpiresLabel(req.getExpiresInDays() + " 天");
        code.setCreatedBy(operatorId);
        code.setStatus("active");
        inviteCodeMapper.insert(code);
        return code;
    }

    @Transactional
    public void revokeCode(Long teamId, Long codeId, Long operatorId) {
        teamService.requireWriter(teamId, operatorId);
        InviteCode code = inviteCodeMapper.selectById(codeId);
        if (code == null || !code.getTeamId().equals(teamId)) {
            throw new BusinessException(40400, "邀请码不存在");
        }
        code.setStatus("revoked");
        inviteCodeMapper.updateById(code);
    }

    /**
     * 用户拿到邀请码加入团队。
     *
     * <p>并发安全（TEAM-INV-006）：先做 used+1 的 CAS 更新（带 status/expires/used&lt;max_uses 条件），
     * 拿到 affectedRows&gt;0 才真正添加成员；如果用户已是成员，则视为幂等 join（回退 used 减 1）。</p>
     */
    @Transactional
    public Long joinByCode(String rawCode, Long userId) {
        if (rawCode == null || rawCode.isBlank()) {
            throw new BusinessException(40001, "邀请码不能为空");
        }
        InviteCode code = inviteCodeMapper.selectOne(
                new LambdaQueryWrapper<InviteCode>().eq(InviteCode::getCode, rawCode.trim()));
        if (code == null) {
            throw new BusinessException(40400, "邀请码不存在");
        }
        // 幂等 join：用户已是成员，直接返回（不消耗 used）
        if (teamMemberService.isMember(code.getTeamId(), userId)) {
            return code.getTeamId();
        }
        if ("revoked".equals(code.getStatus())) {
            throw new BusinessException(40010, "邀请码已撤销");
        }
        if (code.getExpiresAt() != null && code.getExpiresAt().isBefore(LocalDateTime.now())) {
            code.setStatus("expired");
            inviteCodeMapper.updateById(code);
            throw new BusinessException(40010, "邀请码已过期");
        }
        if ("exhausted".equals(code.getStatus()) || code.getUsed() >= code.getMaxUses()) {
            if (!"exhausted".equals(code.getStatus())) {
                code.setStatus("exhausted");
                inviteCodeMapper.updateById(code);
            }
            throw new BusinessException(40010, "邀请码已用完");
        }

        int updated = inviteCodeMapper.incrementUsedIfAvailable(code.getId());
        if (updated == 0) {
            throw new BusinessException(40010, "邀请码已用完");
        }
        try {
            teamMemberService.addMember(code.getTeamId(), userId, code.getRole());
        } catch (RuntimeException e) {
            throw e;
        }
        Team joinedTeam = teamService.requireTeam(code.getTeamId());
        notificationService.notify(NotificationType.TEAM_JOINED, userId, code.getTeamId(), null,
                "你已加入团队：" + joinedTeam.getName(),
                null, "/team", "team", code.getTeamId());

        InviteCode fresh = inviteCodeMapper.selectById(code.getId());
        if (fresh != null && fresh.getUsed() >= fresh.getMaxUses()) {
            fresh.setStatus("exhausted");
            fresh.setExpiresLabel("已用完");
            inviteCodeMapper.updateById(fresh);
        }
        return code.getTeamId();
    }

    // ---------------- 手机邀请 ----------------

    public List<PhoneInviteRes> listPhones(Long teamId, Long operatorId) {
        teamService.requireWriter(teamId, operatorId);
        return invitePhoneMapper.selectByTeam(teamId);
    }

    /** 查询当前用户（按手机号）收到的待响应邀请。 */
    public List<MyPhoneInviteRes> listMyPhoneInvites(String phone) {
        if (phone == null || phone.isBlank()) {
            return List.of();
        }
        return invitePhoneMapper.selectPendingByPhone(phone);
    }

    @Transactional
    public InvitePhone createPhoneInvite(Long teamId, Long operatorId, CreatePhoneInviteReq req) {
        teamService.requireWriter(teamId, operatorId);
        String raw = req.getPhone().replaceAll("\\s+", "");
        InvitePhone existing = invitePhoneMapper.selectOne(new LambdaQueryWrapper<InvitePhone>()
                .eq(InvitePhone::getTeamId, teamId)
                .eq(InvitePhone::getPhoneRaw, raw)
                .eq(InvitePhone::getStatus, "pending"));
        if (existing != null) {
            return existing;
        }
        InvitePhone p = new InvitePhone();
        p.setTeamId(teamId);
        p.setPhoneRaw(raw);
        p.setPhoneMasked(mask(raw));
        p.setInvitedBy(operatorId);
        p.setNote(req.getNote());
        p.setStatus("pending");
        p.setAtLabel("刚刚");
        invitePhoneMapper.insert(p);
        User invitee = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getPhone, raw));
        if (invitee != null) {
            Team team = teamService.requireTeam(teamId);
            notificationService.notify(NotificationType.PHONE_INVITE, invitee.getId(), null, operatorId,
                    "你被邀请加入团队：" + team.getName(),
                    req.getNote() == null ? null : req.getNote(),
                    "/team",
                    "phone_invite", p.getId());
        }
        return p;
    }

    /**
     * 被邀请人接受定向邀请，加入团队。
     * 校验：邀请存在 + 属于该团队 + 状态 pending + 操作人手机号与邀请一致。
     */
    @Transactional
    public Long acceptPhoneInvite(Long teamId, Long inviteId, Long userId) {
        InvitePhone p = invitePhoneMapper.selectById(inviteId);
        if (p == null || !p.getTeamId().equals(teamId)) {
            throw new BusinessException(40400, "邀请不存在");
        }
        if (!"pending".equals(p.getStatus())) {
            throw new BusinessException(40010, "该邀请已失效或已处理");
        }
        User user = userMapper.selectById(userId);
        if (user == null || !p.getPhoneRaw().equals(user.getPhone())) {
            throw new BusinessException(40300, "当前账号手机号与邀请不匹配");
        }
        teamMemberService.addMember(teamId, userId, "MEMBER");
        Team acceptedTeam = teamService.requireTeam(teamId);
        notificationService.notify(NotificationType.TEAM_JOINED, userId, teamId, p.getInvitedBy(),
                "你已加入团队：" + acceptedTeam.getName(),
                null, "/team", "team", teamId);
        p.setStatus("accepted");
        p.setAcceptedByUserId(userId);
        p.setAcceptedAt(LocalDateTime.now());
        invitePhoneMapper.updateById(p);
        return teamId;
    }

    /**
     * 管理员撤销定向邀请（状态 cancelled，区别于被邀请人主动拒绝 declined）。
     */
    @Transactional
    public void cancelPhoneInvite(Long teamId, Long inviteId, Long operatorId) {
        teamService.requireWriter(teamId, operatorId);
        InvitePhone p = invitePhoneMapper.selectById(inviteId);
        if (p == null || !p.getTeamId().equals(teamId)) {
            throw new BusinessException(40400, "邀请不存在");
        }
        if (!"pending".equals(p.getStatus())) {
            throw new BusinessException(40010, "仅 pending 状态可撤销");
        }
        p.setStatus("cancelled");
        invitePhoneMapper.updateById(p);
    }

    // ---------------- helpers ----------------

    private String genCode() {
        StringBuilder sb = new StringBuilder("LD-FE-");
        ThreadLocalRandom r = ThreadLocalRandom.current();
        for (int i = 0; i < 6; i++) {
            sb.append(CODE_ALPHABET.charAt(r.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    private String mask(String phone) {
        if (phone == null) return null;
        String digits = phone.replaceAll("\\D", "");
        if (digits.length() < 7) return phone;
        return digits.substring(0, 3) + "****" + digits.substring(digits.length() - 4);
    }
}
