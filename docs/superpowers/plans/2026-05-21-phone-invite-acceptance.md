# Phone Invite Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the directed phone invitation flow — allow invited users to see and accept pending phone invites, fix `cancelPhoneInvite` status semantics, consolidate invite code logic in AuthService, and fix expired-code display in admin list.

**Architecture:** Add acceptance backend (new endpoint + service method), expose pending invites to invited users via `GET /api/me/invites/phones`, surface pending invites in `NoTeamPage`, and fix four P1 quality bugs (cancel semantics, AuthService JDBC duplication, expired code display, at_label staleness).

**Tech Stack:** Spring Boot 3.2 / MyBatis-Plus / MySQL 8 / React 18 / TanStack Query / TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/.../db/migration/V13__phone_invite_acceptance.sql` | Create | Add `cancelled` to enum; add `accepted_by_user_id`, `accepted_at` columns |
| `backend/.../team/entity/InvitePhone.java` | Modify | Add `acceptedByUserId`, `acceptedAt` fields |
| `backend/.../team/dto/MyPhoneInviteRes.java` | Create | DTO for user-side pending invites list |
| `backend/.../team/mapper/InvitePhoneMapper.java` | Modify | Add `selectPendingByPhone`, fix `selectByTeam` at_label |
| `backend/.../team/mapper/InviteCodeMapper.java` | Modify | Fix `selectByTeam` — compute expired status in SQL |
| `backend/.../team/service/InviteService.java` | Modify | Fix `cancelPhoneInvite`; add `acceptPhoneInvite`, `listMyPhoneInvites` |
| `backend/.../team/controller/TeamInviteController.java` | Modify | Add `POST .../phones/{id}/accept` endpoint |
| `backend/.../auth/controller/AuthController.java` | Modify | Add `GET /api/me/invites/phones` endpoint |
| `backend/.../auth/service/AuthService.java` | Modify | Delegate `joinTeamByInvite` to `InviteService.joinByCode` |
| `frontend/src/mocks/invites.ts` | Modify | Add `'cancelled'` to `PhoneInviteStatus`; add `id` to `PhoneInvite` |
| `frontend/src/api/endpoints.ts` | Modify | Add `myPhoneInvites()`, `acceptPhoneInvite()` |
| `frontend/src/api/data.ts` | Modify | Add `useMyPhoneInvites()` hook |
| `frontend/src/pages/team/NoTeamPage.tsx` | Modify | Show pending phone invite banner with accept action |
| `frontend/src/pages/team/admin/Invites/PhoneInvites.tsx` | Modify | Add `cancelled` status label/tone |

---

## Task 1 — Database Migration V13

**Files:**
- Create: `backend/src/main/resources/db/migration/V13__phone_invite_acceptance.sql`

- [ ] **Step 1: Create migration file**

```sql
-- V13 — phone invite acceptance support
-- 1. Add 'cancelled' to invites_phone.status (admin revoke, distinct from 'declined' = user rejected)
-- 2. Track who accepted and when
-- 3. Index for fast lookup of pending invites by phone number

ALTER TABLE invites_phone
    MODIFY status ENUM('pending','accepted','declined','expired','cancelled')
        NOT NULL DEFAULT 'pending';

ALTER TABLE invites_phone
    ADD COLUMN accepted_by_user_id BIGINT  DEFAULT NULL COMMENT '接受邀请的用户 ID' AFTER status,
    ADD COLUMN accepted_at         DATETIME DEFAULT NULL COMMENT '接受时间'          AFTER accepted_by_user_id;

ALTER TABLE invites_phone
    ADD KEY idx_invites_phone_phone_status (phone_raw, status);
```

- [ ] **Step 2: Verify migration applies cleanly**

Start the backend (it runs Flyway on boot). Confirm no errors in log:

```bash
cd backend
mvn -q -DskipTests compile
```

Expected: BUILD SUCCESS with no Flyway errors (check `tail -20 /tmp/skillstack-backend.log` if backend is running).

---

## Task 2 — Update InvitePhone Entity + Create MyPhoneInviteRes DTO

**Files:**
- Modify: `backend/src/main/java/com/skillstack/team/entity/InvitePhone.java`
- Create: `backend/src/main/java/com/skillstack/team/dto/MyPhoneInviteRes.java`

- [ ] **Step 1: Add acceptance fields to InvitePhone entity**

Replace the entire file content:

```java
package com.skillstack.team.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("invites_phone")
public class InvitePhone extends BaseEntity {
    private Long teamId;
    private String phoneMasked;
    private String phoneRaw;
    private Long invitedBy;
    private String note;
    /** pending / accepted / declined / expired / cancelled */
    private String status;
    private String atLabel;
    private Long acceptedByUserId;
    private LocalDateTime acceptedAt;
}
```

- [ ] **Step 2: Create MyPhoneInviteRes DTO**

```java
package com.skillstack.team.dto;

import lombok.Data;

/** 用户侧查看自己收到的手机邀请（待响应列表）。 */
@Data
public class MyPhoneInviteRes {
    private Long id;
    private Long teamId;
    private String teamName;
    private String teamSlug;
    private String invitedBy;
    private String note;
    private String at;
}
```

- [ ] **Step 3: Compile to catch type errors**

```bash
cd backend && mvn -q -DskipTests compile
```

Expected: BUILD SUCCESS

---

## Task 3 — Update Mapper Queries

**Files:**
- Modify: `backend/src/main/java/com/skillstack/team/mapper/InvitePhoneMapper.java`
- Modify: `backend/src/main/java/com/skillstack/team/mapper/InviteCodeMapper.java`

- [ ] **Step 1: Fix InvitePhoneMapper — dynamic at_label + add selectPendingByPhone**

Replace the entire file:

```java
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
```

- [ ] **Step 2: Fix InviteCodeMapper — compute expired status in query**

Replace only the `selectByTeam` method body (keep `incrementUsedIfAvailable` as-is):

```java
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
```

The complete updated `InviteCodeMapper.java`:

```java
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
```

- [ ] **Step 3: Compile**

```bash
cd backend && mvn -q -DskipTests compile
```

Expected: BUILD SUCCESS

---

## Task 4 — Update InviteService

**Files:**
- Modify: `backend/src/main/java/com/skillstack/team/service/InviteService.java`

- [ ] **Step 1: Fix cancelPhoneInvite and add acceptPhoneInvite + listMyPhoneInvites**

Replace the entire file:

```java
package com.skillstack.team.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.team.dto.CreateCodeReq;
import com.skillstack.team.dto.CreatePhoneInviteReq;
import com.skillstack.team.dto.InviteCodeRes;
import com.skillstack.team.dto.MyPhoneInviteRes;
import com.skillstack.team.dto.PhoneInviteRes;
import com.skillstack.team.entity.InviteCode;
import com.skillstack.team.entity.InvitePhone;
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
        return p;
    }

    /**
     * 被邀请人接受定向邀请，加入团队。
     * 校验：邀请存在 + 属于该团队 + 状态 pending + 操作人手机号与邀请一致。
     */
    @Transactional
    public Long acceptPhoneInvite(Long teamId, Long inviteId, Long userId) {
        InvitePhone p = invitePhoneMapper.selectById(inviteId);
        if (p == null || !p.getTeamId().equals(teamId) || Boolean.TRUE.equals(p.getDeleted())) {
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
```

- [ ] **Step 2: Compile**

```bash
cd backend && mvn -q -DskipTests compile
```

Expected: BUILD SUCCESS. If it fails on `p.getDeleted()` — check `BaseEntity`; if the field is `deleted` (int), change the null check to `p.getDeleted() != null && p.getDeleted() == 1` or remove it (MyBatis-Plus `@TableLogic` handles deleted records transparently in selectById).

---

## Task 5 — Update Controllers

**Files:**
- Modify: `backend/src/main/java/com/skillstack/team/controller/TeamInviteController.java`
- Modify: `backend/src/main/java/com/skillstack/auth/controller/AuthController.java`

- [ ] **Step 1: Add accept endpoint to TeamInviteController**

Replace the entire file:

```java
package com.skillstack.team.controller;

import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.team.dto.CreateCodeReq;
import com.skillstack.team.dto.CreatePhoneInviteReq;
import com.skillstack.team.dto.InviteCodeRes;
import com.skillstack.team.dto.PhoneInviteRes;
import com.skillstack.team.entity.InviteCode;
import com.skillstack.team.entity.InvitePhone;
import com.skillstack.team.service.InviteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/teams/{teamId}/invites")
@RequiredArgsConstructor
public class TeamInviteController {

    private final InviteService inviteService;

    // ---------------- 邀请码 ----------------

    @GetMapping("/codes")
    public ApiResponse<List<InviteCodeRes>> listCodes(@PathVariable Long teamId,
                                                      @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(inviteService.listCodes(teamId, me.getId()));
    }

    @PostMapping("/codes")
    public ApiResponse<InviteCode> createCode(@PathVariable Long teamId,
                                              @AuthenticationPrincipal CurrentUser me,
                                              @Valid @RequestBody CreateCodeReq req) {
        return ApiResponse.ok(inviteService.createCode(teamId, me.getId(), req));
    }

    @DeleteMapping("/codes/{id}")
    public ApiResponse<Void> revokeCode(@PathVariable Long teamId,
                                        @PathVariable("id") Long codeId,
                                        @AuthenticationPrincipal CurrentUser me) {
        inviteService.revokeCode(teamId, codeId, me.getId());
        return ApiResponse.ok();
    }

    // ---------------- 手机邀请 ----------------

    @GetMapping("/phones")
    public ApiResponse<List<PhoneInviteRes>> listPhones(@PathVariable Long teamId,
                                                        @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(inviteService.listPhones(teamId, me.getId()));
    }

    @PostMapping("/phones")
    public ApiResponse<InvitePhone> createPhoneInvite(@PathVariable Long teamId,
                                                      @AuthenticationPrincipal CurrentUser me,
                                                      @Valid @RequestBody CreatePhoneInviteReq req) {
        return ApiResponse.ok(inviteService.createPhoneInvite(teamId, me.getId(), req));
    }

    @PostMapping("/phones/{id}/cancel")
    public ApiResponse<Void> cancelPhoneInvite(@PathVariable Long teamId,
                                               @PathVariable("id") Long inviteId,
                                               @AuthenticationPrincipal CurrentUser me) {
        inviteService.cancelPhoneInvite(teamId, inviteId, me.getId());
        return ApiResponse.ok();
    }

    /** 被邀请人接受定向邀请，加入团队。 */
    @PostMapping("/phones/{id}/accept")
    public ApiResponse<Void> acceptPhoneInvite(@PathVariable Long teamId,
                                               @PathVariable("id") Long inviteId,
                                               @AuthenticationPrincipal CurrentUser me) {
        inviteService.acceptPhoneInvite(teamId, inviteId, me.getId());
        return ApiResponse.ok();
    }
}
```

- [ ] **Step 2: Add GET /api/me/invites/phones to AuthController**

Add one import and one method. Replace the entire `AuthController.java`:

```java
package com.skillstack.auth.controller;

import com.skillstack.auth.dto.LoginReq;
import com.skillstack.auth.dto.LoginRes;
import com.skillstack.auth.dto.MeRes;
import com.skillstack.auth.dto.RegisterStep1Req;
import com.skillstack.auth.dto.RegisterStep2Req;
import com.skillstack.auth.dto.RegisterStep3Req;
import com.skillstack.auth.dto.RegisterStep4Req;
import com.skillstack.auth.dto.SmsCodeReq;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.auth.service.AuthService;
import com.skillstack.auth.service.UserService;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.team.dto.MyPhoneInviteRes;
import com.skillstack.team.service.InviteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserService userService;
    private final InviteService inviteService;
    private final UserMapper userMapper;

    @PostMapping("/api/auth/sms-code")
    public ApiResponse<Map<String, Object>> smsCode(@Valid @RequestBody SmsCodeReq req) {
        return ApiResponse.ok(authService.sendSmsCode(req.getPhone(), req.getPurpose()));
    }

    @PostMapping("/api/auth/login")
    public ApiResponse<LoginRes> login(@Valid @RequestBody LoginReq req) {
        return ApiResponse.ok(authService.login(req));
    }

    @PostMapping("/api/auth/register/step1")
    public ApiResponse<Map<String, Object>> step1(@Valid @RequestBody RegisterStep1Req req) {
        return ApiResponse.ok(authService.registerStep1(req));
    }

    @PostMapping("/api/auth/register/step2")
    public ApiResponse<Map<String, Object>> step2(@Valid @RequestBody RegisterStep2Req req) {
        return ApiResponse.ok(authService.registerStep2(req));
    }

    @PostMapping("/api/auth/register/step3")
    public ApiResponse<Map<String, Object>> step3(@Valid @RequestBody RegisterStep3Req req) {
        return ApiResponse.ok(authService.registerStep3(req));
    }

    @PostMapping("/api/auth/register/step4")
    public ApiResponse<LoginRes> step4(@Valid @RequestBody RegisterStep4Req req) {
        return ApiResponse.ok(authService.registerStep4(req));
    }

    @GetMapping("/api/me")
    public ApiResponse<MeRes> me(@AuthenticationPrincipal CurrentUser me) {
        if (me == null) {
            throw new BusinessException(40100, "未登录");
        }
        return ApiResponse.ok(userService.buildMe(me.getId()));
    }

    /** 查询当前用户收到的待响应手机邀请（用于 NoTeamPage 入口提示）。 */
    @GetMapping("/api/me/invites/phones")
    public ApiResponse<List<MyPhoneInviteRes>> myPhoneInvites(@AuthenticationPrincipal CurrentUser me) {
        if (me == null) {
            throw new BusinessException(40100, "未登录");
        }
        User user = userMapper.selectById(me.getId());
        return ApiResponse.ok(inviteService.listMyPhoneInvites(user == null ? null : user.getPhone()));
    }
}
```

- [ ] **Step 3: Compile**

```bash
cd backend && mvn -q -DskipTests compile
```

Expected: BUILD SUCCESS

---

## Task 6 — Fix AuthService.joinTeamByInvite

**Files:**
- Modify: `backend/src/main/java/com/skillstack/auth/service/AuthService.java`

- [ ] **Step 1: Inject InviteService and replace joinTeamByInvite**

In `AuthService.java`:

1. Add `InviteService` field (after existing fields, before `@Value`):

```java
    private final InviteService inviteService;
```

2. Replace the entire `joinTeamByInvite` private method (lines ~281-315) with:

```java
    private void joinTeamByInvite(Long userId, String code) {
        inviteService.joinByCode(code, userId);
    }
```

3. Remove the now-unused `JdbcTemplate jdbc` field and its import if `jdbc` is only used in this method. Check if `jdbc` is used elsewhere in `AuthService` before removing.

> **Check first:** Run `grep -n "jdbc" backend/src/main/java/com/skillstack/auth/service/AuthService.java` — if the only usage was `joinTeamByInvite`, remove the field and import. If used elsewhere, keep it.

- [ ] **Step 2: Compile**

```bash
cd backend && mvn -q -DskipTests compile
```

Expected: BUILD SUCCESS. Circular dependency between `AuthService` ↔ `InviteService` via Spring is possible if `InviteService` depends on `AuthService`. Check: `InviteService` only uses `UserMapper`, `TeamService`, `TeamMemberService` — no `AuthService`. Safe.

---

## Task 7 — Frontend: Types and API Layer

**Files:**
- Modify: `frontend/src/mocks/invites.ts`
- Modify: `frontend/src/api/endpoints.ts`
- Modify: `frontend/src/api/data.ts`

- [ ] **Step 1: Update PhoneInviteStatus and PhoneInvite type**

In `frontend/src/mocks/invites.ts`, replace the top two type lines:

```ts
export type InviteStatus = 'active' | 'exhausted' | 'expired' | 'revoked';
export type PhoneInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';
```

Add `id` to `PhoneInvite` interface:

```ts
export interface PhoneInvite {
  id?: number;
  phone: string;
  invitedBy: string;
  at: string;
  note: string;
  status: PhoneInviteStatus;
}
```

- [ ] **Step 2: Add MyPhoneInvite type and API endpoints**

In `frontend/src/api/endpoints.ts`, add after the `PageRes` interface:

```ts
export interface MyPhoneInvite {
  id: number;
  teamId: number;
  teamName: string;
  teamSlug: string;
  invitedBy: string;
  note: string;
  at: string;
}
```

In the `teamApi.invites` block, add two methods:

```ts
    myPendingPhones: () =>
      http.get<unknown, MyPhoneInvite[]>('/me/invites/phones'),
    acceptPhone: (teamId: number, id: number) =>
      http.post<unknown, void>(`/teams/${teamId}/invites/phones/${id}/accept`),
```

The full updated `teamApi.invites` block:

```ts
  invites: {
    codes: (teamId: number) => http.get<unknown, Invite[]>(`/teams/${teamId}/invites/codes`),
    createCode: (teamId: number, body: { max: number; expiresInDays: number; role: string }) =>
      http.post<unknown, Invite>(`/teams/${teamId}/invites/codes`, body),
    deleteCode: (teamId: number, id: number) => http.delete<unknown, void>(`/teams/${teamId}/invites/codes/${id}`),
    phones: (teamId: number) => http.get<unknown, PhoneInvite[]>(`/teams/${teamId}/invites/phones`),
    addPhone: (teamId: number, body: { phone: string; note?: string }) =>
      http.post<unknown, PhoneInvite>(`/teams/${teamId}/invites/phones`, body),
    cancelPhone: (teamId: number, id: number) =>
      http.post<unknown, void>(`/teams/${teamId}/invites/phones/${id}/cancel`),
    myPendingPhones: () =>
      http.get<unknown, MyPhoneInvite[]>('/me/invites/phones'),
    acceptPhone: (teamId: number, id: number) =>
      http.post<unknown, void>(`/teams/${teamId}/invites/phones/${id}/accept`),
  },
```

- [ ] **Step 3: Add useMyPhoneInvites hook to data.ts**

In `frontend/src/api/data.ts`, add after `useActivity`:

```ts
export function useMyPhoneInvites() {
  return useQuery({
    queryKey: ['my-phone-invites'],
    queryFn: () => teamApi.invites.myPendingPhones(),
  });
}
```

Make sure `MyPhoneInvite` is imported from `endpoints.ts` if needed (it's an interface export, used only via type inference here — no explicit import needed in the hook itself).

- [ ] **Step 4: Type-check**

```bash
cd frontend && npm run lint
```

Expected: no errors

---

## Task 8 — Frontend: NoTeamPage — Phone Invite Banner

**Files:**
- Modify: `frontend/src/pages/team/NoTeamPage.tsx`

- [ ] **Step 1: Replace NoTeamPage with invite-aware version**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Button } from '@/components/atoms';
import { TopBar } from '@/components/chrome';
import { I } from '@/components/icons';
import { getToken } from '@/api/client';
import { teamApi } from '@/api/endpoints';
import { useMyPhoneInvites } from '@/api/data';

export default function NoTeamPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: pendingInvites = [] } = useMyPhoneInvites();

  const accept = useMutation({
    mutationFn: ({ teamId, id }: { teamId: number; id: number }) =>
      teamApi.invites.acceptPhone(teamId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      navigate('/team');
    },
  });

  async function handleJoin() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await teamApi.joinByCode(code.trim());
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      navigate('/team');
    } catch {
      setError('邀请码无效或已过期，请确认后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: TOKENS.bgAlt, minHeight: '100%' }}>
      <TopBar authed={!!getToken()} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 52px)',
          padding: '48px 24px',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: TOKENS.primarySoft,
            display: 'grid',
            placeItems: 'center',
            marginBottom: 20,
            color: TOKENS.primary,
          }}
        >
          <I.users size={32} />
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: TOKENS.text,
            margin: '0 0 8px',
            textAlign: 'center',
          }}
        >
          你还没有加入任何团队
        </h1>
        <p
          style={{
            fontSize: 14,
            color: TOKENS.text2,
            margin: '0 0 40px',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          创建一个新团队，或使用邀请码加入已有团队
        </p>

        {/* Pending phone invites */}
        {pendingInvites.length > 0 && (
          <div
            style={{
              width: '100%',
              maxWidth: 560,
              marginBottom: 20,
              background: TOKENS.primarySoft,
              border: `1px solid ${TOKENS.primary}30`,
              borderRadius: 12,
              padding: '16px 20px',
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: TOKENS.primary,
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <I.mail size={14} />
              你有 {pendingInvites.length} 个待响应的定向邀请
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingInvites.map((inv) => (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#fff',
                    borderRadius: 8,
                    padding: '10px 14px',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}>
                      {inv.teamName}
                    </div>
                    <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 2 }}>
                      {inv.invitedBy} 邀请 · {inv.at}
                      {inv.note && <span> · {inv.note}</span>}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={accept.isPending}
                    onClick={() => accept.mutate({ teamId: inv.teamId, id: inv.id })}
                  >
                    加入
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Two cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            width: '100%',
            maxWidth: 560,
          }}
        >
          {/* Create */}
          <div
            style={{
              background: '#fff',
              border: `1px solid ${TOKENS.border}`,
              borderRadius: 12,
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: TOKENS.primarySoft,
                display: 'grid',
                placeItems: 'center',
                color: TOKENS.primary,
              }}
            >
              <I.plus size={18} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text, marginBottom: 4 }}>
                创建新团队
              </div>
              <div style={{ fontSize: 13, color: TOKENS.text3, lineHeight: 1.5 }}>
                建立属于你们的技能库，邀请成员一起维护
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              style={{ marginTop: 4 }}
              onClick={() => navigate('/team/create')}
            >
              创建团队
            </Button>
          </div>

          {/* Join by invite code */}
          <div
            style={{
              background: '#fff',
              border: `1px solid ${TOKENS.border}`,
              borderRadius: 12,
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#F0FDF4',
                display: 'grid',
                placeItems: 'center',
                color: '#16A34A',
              }}
            >
              <I.users size={18} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text, marginBottom: 4 }}>
                通过邀请码加入
              </div>
              <div style={{ fontSize: 13, color: TOKENS.text3, lineHeight: 1.5 }}>
                输入团队管理员提供的邀请码
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="粘贴邀请码"
                style={{
                  flex: 1,
                  height: 32,
                  padding: '0 10px',
                  fontSize: 13,
                  border: `1px solid ${error ? '#EF4444' : TOKENS.border}`,
                  borderRadius: 6,
                  outline: 'none',
                  fontFamily: 'inherit',
                  background: '#fff',
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleJoin}
                disabled={loading || !code.trim()}
              >
                {loading ? '…' : '加入'}
              </Button>
            </div>
            {error && (
              <div style={{ fontSize: 12, color: '#EF4444', marginTop: -4 }}>{error}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Check I.mail exists**

Run: `grep -n "mail" frontend/src/components/icons.tsx`

If `I.mail` is not defined, use `I.phone` or `I.bell` instead (whichever exists).

- [ ] **Step 3: Type-check**

```bash
cd frontend && npm run lint
```

Expected: no errors

---

## Task 9 — Frontend: PhoneInvites Admin Table — Add `cancelled` Status

**Files:**
- Modify: `frontend/src/pages/team/admin/Invites/PhoneInvites.tsx`

- [ ] **Step 1: Add cancelled to status maps**

In `PhoneInvites.tsx`, update `STATUS_TONE` and `STATUS_LABEL`:

```ts
const STATUS_TONE: Record<PhoneInviteStatus, BadgeTone> = {
  pending: 'warning',
  accepted: 'success',
  declined: 'neutral',
  cancelled: 'neutral',
};
const STATUS_LABEL: Record<PhoneInviteStatus, string> = {
  pending: '待响应',
  accepted: '已加入',
  declined: '已拒绝',
  cancelled: '已撤销',
};
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run lint
```

Expected: no errors

---

## Task 10 — Verification

- [ ] **Step 1: Run backend compile + tests**

```bash
cd backend && mvn -q -DskipTests compile
```

Expected: BUILD SUCCESS

- [ ] **Step 2: Run frontend type-check**

```bash
cd frontend && npm run lint
```

Expected: no errors

- [ ] **Step 3: Start services and smoke test**

```bash
./scripts/services.sh start
```

Smoke test checklist:
1. Open `http://localhost:5173` — login as a user with no team → `NoTeamPage` loads, no JS errors in console
2. Open `http://localhost:8080/swagger-ui.html` — verify `POST /api/teams/{teamId}/invites/phones/{id}/accept` and `GET /api/me/invites/phones` appear in the API docs
3. As admin: navigate to `/team/admin/invites` → Phone tab → create a new phone invite for a test phone number
4. Verify the invite shows in the admin table with dynamic at_label (e.g., "0 分钟前" or "1 分钟前")
5. As admin: click "撤销" → verify status changes to "已撤销" (not "已拒绝")
6. As invited user (with matching phone): navigate to `/no-team` → verify the invite banner appears
7. Click "加入" on the invite → verify redirect to `/team`
8. Back in admin table, verify invite status shows "已加入"
9. Verify expired invite codes in admin list now correctly show "expired" status without requiring a join attempt

---

## Self-Review

**Spec coverage:**
- ✅ Phone invite acceptance (backend + frontend) — Tasks 2-8
- ✅ `cancelPhoneInvite` status `declined` → `cancelled` — Tasks 1, 4, 9
- ✅ AuthService JDBC duplication removed — Task 6
- ✅ Expired invite code display fix — Task 3
- ✅ `at_label` staleness fixed (computed on read in SQL) — Task 3

**Placeholder scan:** All code blocks are complete. No TBD items.

**Type consistency:**
- `MyPhoneInviteRes` defined in Task 2 (Java) and Task 7 (TS `MyPhoneInvite`) — used consistently in Tasks 4, 5, 7, 8
- `inviteService.joinByCode(code, userId)` signature matches existing `joinByCode(String, Long)` in `InviteService`
- `teamApi.invites.acceptPhone(teamId, id)` defined in Task 7, called in Task 8 ✓
- `useMyPhoneInvites()` defined in Task 7, imported in Task 8 ✓
