# 超级管理员团队详情页实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为超级管理员控制台新增 `/admin/teams/:id` 团队详情页，支持查看团队信息/成员/Skill/套件/设置，并允许超管以审计可追踪的方式管理团队成员（加入、改角色、踢出）与改基础字段（name/slug/status）。

**Architecture:** 方案 C —— 新 controller，service 复用。后端把 `TeamMemberService` 现有的核心写逻辑抽到 `internalUpdateRole / internalRemove` 内部方法，新加的 `AdminTeamMemberController` 与现有 `TeamMemberController` 都调它们。Skill/套件 Tab 完全复用既有 `useAdminSkills({teamId})` / `useAdminSuites({teamId})`，零新后端。所有超管写操作通过 `AuditLogService.record` 写审计。

**Tech Stack:** Spring Boot 3.2 / MyBatis Plus / JdbcTemplate / React 18 + Vite + TanStack Query + Axios + Tailwind / Radix UI / TS。

**关联 spec：** `docs/superpowers/specs/2026-05-26-admin-team-detail-design.md`

---

## 文件结构

### 新增

**后端：**
- `backend/src/main/java/com/skillstack/admin/controller/AdminTeamMemberController.java`
- `backend/src/main/java/com/skillstack/admin/dto/AdminUpdateTeamReq.java`
- `backend/src/main/java/com/skillstack/admin/dto/AdminAddTeamMemberReq.java`
- `backend/src/main/java/com/skillstack/admin/dto/AdminUpdateTeamMemberRoleReq.java`
- `backend/src/test/java/com/skillstack/admin/controller/AdminTeamMemberControllerTest.java`
- `backend/src/test/java/com/skillstack/admin/service/AdminTeamServicePatchTest.java`

**前端：**
- `frontend/src/pages/admin/TeamDetail.tsx`（路由组件，5 个 Tab 的容器）
- `frontend/src/pages/admin/teamDetail/OverviewTab.tsx`
- `frontend/src/pages/admin/teamDetail/MembersTab.tsx`
- `frontend/src/pages/admin/teamDetail/AddMemberDialog.tsx`
- `frontend/src/pages/admin/teamDetail/SkillsTab.tsx`
- `frontend/src/pages/admin/teamDetail/SuitesTab.tsx`
- `frontend/src/pages/admin/teamDetail/SettingsTab.tsx`
- `frontend/src/pages/admin/teamDetail/tableStyles.ts`（抽离的表格样式）

### 修改

**后端：**
- `backend/src/main/java/com/skillstack/team/service/TeamMemberService.java`（抽出 `internalUpdateRole` / `internalRemove`）
- `backend/src/main/java/com/skillstack/admin/controller/AdminTeamController.java`（追加 `PATCH /api/admin/teams/{id}`）
- `backend/src/main/java/com/skillstack/admin/service/AdminTeamService.java`（追加 `updateBasic(id, name, slug)`）

**前端：**
- `frontend/src/api/endpoints.ts`（追加 `AdminUpdateTeamReq` / `AdminAddTeamMemberReq` / `AdminTeamMember` 类型与 5 个 endpoint）
- `frontend/src/api/admin.ts`（追加 5 个 hooks）
- `frontend/src/pages/admin/Teams.tsx`（"详情"按钮 `window.open` → `navigate('/admin/teams/{id}')`）
- `frontend/src/router.tsx`（注册 `/admin/teams/:id`）

---

## Task 1：抽出 `TeamMemberService` 内部方法

**Files:**
- Modify: `backend/src/main/java/com/skillstack/team/service/TeamMemberService.java`（重构第 50-88 行）

目标：把 `updateRole` 与 `remove` 里"权限校验之后"的核心写逻辑抽到内部方法 `internalUpdateRole(teamId, userId, role, operatorId)` 与 `internalRemove(teamId, userId, operatorId)`。`operatorId` 用于通知中的 `actorId`。原方法保留 `requireWriter` 校验，然后调用内部方法。

- [ ] **Step 1：检查现有测试是否覆盖这两个方法**

```bash
grep -rn "updateRole\|TeamMemberService" backend/src/test/java | head
```

期望：找到现有覆盖（如有），后续重构后必须仍然通过。如无现成测试，重构后跑全量后端测试 `mvn test`。

- [ ] **Step 2：重构 `updateRole`，提取 `internalUpdateRole`**

把 `backend/src/main/java/com/skillstack/team/service/TeamMemberService.java` 第 50-70 行替换为：

```java
@Transactional
public void updateRole(Long teamId, Long targetUserId, Long operatorId, UpdateMemberReq req) {
    teamService.requireWriter(teamId, operatorId);
    String role = req.getRole() == null ? null : req.getRole().trim().toUpperCase();
    if (!TeamService.isValidRole(role)) {
        throw new BusinessException(40001, "非法角色：" + role);
    }
    internalUpdateRole(teamId, targetUserId, role, operatorId);
}

/**
 * 不做调用方权限校验的角色变更。供 admin 端复用。
 * 调用方负责：1) 鉴权（必须是 Writer 或超管），2) role 标准化与合法性校验。
 * 保留 Owner 保护：不能修改 Owner，不能升为 Owner。
 */
@Transactional
public void internalUpdateRole(Long teamId, Long targetUserId, String role, Long operatorId) {
    TeamMember target = findMember(teamId, targetUserId);
    if ("OWNER".equals(target.getRole())) {
        throw new BusinessException(40300, "T_FORBIDDEN: 不能修改 Owner");
    }
    if ("OWNER".equals(role)) {
        throw new BusinessException(40300, "T_FORBIDDEN: 不能在此处转让 Owner");
    }
    target.setRole(role);
    teamMemberMapper.updateById(target);
    com.skillstack.team.entity.Team team = teamService.requireTeam(teamId);
    notificationService.notify(NotificationType.TEAM_ROLE_CHANGED, targetUserId, teamId, operatorId,
            "你在 " + team.getName() + " 的角色已变更为 " + role,
            null, "/team", "team_member", target.getId());
}
```

- [ ] **Step 3：重构 `remove`，提取 `internalRemove`**

把同一文件第 72-88 行替换为：

```java
@Transactional
public void remove(Long teamId, Long targetUserId, Long operatorId) {
    teamService.requireWriter(teamId, operatorId);
    internalRemove(teamId, targetUserId, operatorId);
}

/**
 * 不做调用方权限校验的移除。供 admin 端复用。
 * 调用方负责鉴权。保留 Owner 保护：不能移除 Owner。
 */
@Transactional
public void internalRemove(Long teamId, Long targetUserId, Long operatorId) {
    TeamMember target = findMember(teamId, targetUserId);
    if ("OWNER".equals(target.getRole())) {
        throw new BusinessException(40300, "T_FORBIDDEN: 不能移除 Owner");
    }
    teamMemberMapper.deleteById(target.getId());
    Team t = teamService.requireTeam(teamId);
    if (t.getMembersCount() != null && t.getMembersCount() > 0) {
        t.setMembersCount(t.getMembersCount() - 1);
        teamMapper.updateById(t);
    }
    notificationService.notify(NotificationType.TEAM_REMOVED, targetUserId, teamId, operatorId,
            "你已从团队 " + t.getName() + " 中移除",
            null, "/", "team_member", target.getId());
}
```

- [ ] **Step 4：编译并跑回归**

Run: `cd backend && mvn -q -DskipTests compile && mvn test`
Expected: 编译通过，原 team 模块测试全部 PASS（行为不变）。

- [ ] **Step 5：commit**

```bash
git add backend/src/main/java/com/skillstack/team/service/TeamMemberService.java
git commit -m "refactor(team): extract internalUpdateRole/internalRemove for admin reuse"
```

---

## Task 2：新增 admin team member 写接口

**Files:**
- Create: `backend/src/main/java/com/skillstack/admin/dto/AdminAddTeamMemberReq.java`
- Create: `backend/src/main/java/com/skillstack/admin/dto/AdminUpdateTeamMemberRoleReq.java`
- Create: `backend/src/main/java/com/skillstack/admin/controller/AdminTeamMemberController.java`
- Test: `backend/src/test/java/com/skillstack/admin/controller/AdminTeamMemberControllerTest.java`

- [ ] **Step 1：写两个请求 DTO**

`AdminAddTeamMemberReq.java`：

```java
package com.skillstack.admin.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class AdminAddTeamMemberReq {
    @NotNull(message = "userId 不能为空")
    private Long userId;

    @NotNull(message = "role 不能为空")
    @Pattern(regexp = "ADMIN|MEMBER", message = "role 只允许 ADMIN 或 MEMBER")
    private String role;
}
```

`AdminUpdateTeamMemberRoleReq.java`：

```java
package com.skillstack.admin.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class AdminUpdateTeamMemberRoleReq {
    @NotNull(message = "role 不能为空")
    @Pattern(regexp = "ADMIN|MEMBER", message = "role 只允许 ADMIN 或 MEMBER")
    private String role;
}
```

- [ ] **Step 2：写失败的 controller 测试**

`backend/src/test/java/com/skillstack/admin/controller/AdminTeamMemberControllerTest.java`。参考 `backend/src/test/java/com/skillstack/admin/controller/AdminOAuthControllerTest.java` 的搭建方式（`@SpringBootTest` + `MockMvc`）。覆盖以下用例：

```java
package com.skillstack.admin.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AdminTeamMemberControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

    // 假设种子数据：team id=1, owner userId=1, candidate user id=42（非成员）
    private static final long TEAM_ID = 1L;
    private static final long OWNER_ID = 1L;
    private static final long CANDIDATE_ID = 42L;

    @Test
    @WithMockUser(username = "super", authorities = "SUPER_ADMIN")
    void list_returns_members() throws Exception {
        mvc.perform(get("/api/admin/teams/{id}/members", TEAM_ID))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.code").value(0))
           .andExpect(jsonPath("$.data.items").isArray());
    }

    @Test
    @WithMockUser(username = "super", authorities = "SUPER_ADMIN")
    void add_member_succeeds_then_idempotent_conflict() throws Exception {
        String body = om.writeValueAsString(java.util.Map.of("userId", CANDIDATE_ID, "role", "MEMBER"));
        mvc.perform(post("/api/admin/teams/{id}/members", TEAM_ID)
                .contentType("application/json").content(body))
           .andExpect(status().isOk());
        // 再加一次：addMember 是幂等（已存在直接返回），但 controller 层应返回 200 + 既有成员。
        mvc.perform(post("/api/admin/teams/{id}/members", TEAM_ID)
                .contentType("application/json").content(body))
           .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "super", authorities = "SUPER_ADMIN")
    void update_role_to_owner_rejected() throws Exception {
        String body = om.writeValueAsString(java.util.Map.of("role", "OWNER"));
        mvc.perform(put("/api/admin/teams/{id}/members/{uid}", TEAM_ID, CANDIDATE_ID)
                .contentType("application/json").content(body))
           .andExpect(status().isBadRequest()); // @Pattern 校验失败
    }

    @Test
    @WithMockUser(username = "super", authorities = "SUPER_ADMIN")
    void remove_owner_rejected() throws Exception {
        mvc.perform(delete("/api/admin/teams/{id}/members/{uid}", TEAM_ID, OWNER_ID))
           .andExpect(status().isOk())  // 业务异常包在 ApiResponse 里
           .andExpect(jsonPath("$.code").value(40300));
    }
}
```

- [ ] **Step 3：跑测试确认全部 FAIL**

Run: `cd backend && mvn test -Dtest=AdminTeamMemberControllerTest`
Expected: 4 个 case 全 FAIL（controller 未创建）。

- [ ] **Step 4：写 controller 让测试通过**

`backend/src/main/java/com/skillstack/admin/controller/AdminTeamMemberController.java`：

```java
package com.skillstack.admin.controller;

import com.skillstack.admin.dto.AdminAddTeamMemberReq;
import com.skillstack.admin.dto.AdminUpdateTeamMemberRoleReq;
import com.skillstack.admin.security.RequireSuperAdmin;
import com.skillstack.admin.service.AuditLogService;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.common.web.PageQuery;
import com.skillstack.common.web.PageResult;
import com.skillstack.team.dto.TeamMemberRes;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.service.TeamMemberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequireSuperAdmin
@RequestMapping("/api/admin/teams/{teamId}/members")
public class AdminTeamMemberController {

    private final TeamMemberService teamMemberService;
    private final AuditLogService auditLogService;

    @GetMapping
    public ApiResponse<PageResult<TeamMemberRes>> list(@PathVariable Long teamId,
                                                       @RequestParam(required = false) String role,
                                                       @RequestParam(required = false) String q,
                                                       PageQuery pq,
                                                       @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(teamMemberService.page(teamId, role, q, pq, requireActor(me)));
    }

    @PostMapping
    public ApiResponse<Void> add(@PathVariable Long teamId,
                                 @Valid @RequestBody AdminAddTeamMemberReq req,
                                 @AuthenticationPrincipal CurrentUser me) {
        Long actor = requireActor(me);
        TeamMember m = teamMemberService.addMember(teamId, req.getUserId(), req.getRole());
        Map<String, Object> payload = payload(teamId, req.getUserId(), null, req.getRole());
        payload.put("memberId", m.getId());
        auditLogService.record(actor, "team_member.add", "team_member", m.getId(), payload);
        return ApiResponse.ok();
    }

    @PutMapping("/{userId}")
    public ApiResponse<Void> updateRole(@PathVariable Long teamId,
                                        @PathVariable Long userId,
                                        @Valid @RequestBody AdminUpdateTeamMemberRoleReq req,
                                        @AuthenticationPrincipal CurrentUser me) {
        Long actor = requireActor(me);
        // 先查旧角色用于 audit
        String oldRole = teamMemberService.page(teamId, null, null,
                new PageQuery(), actor).getItems().stream()
                .filter(it -> userId.equals(it.getUserId()))
                .map(TeamMemberRes::getRole).findFirst().orElse(null);
        teamMemberService.internalUpdateRole(teamId, userId, req.getRole(), actor);
        auditLogService.record(actor, "team_member.role_change", "team_member", userId,
                payload(teamId, userId, oldRole, req.getRole()));
        return ApiResponse.ok();
    }

    @DeleteMapping("/{userId}")
    public ApiResponse<Void> remove(@PathVariable Long teamId,
                                    @PathVariable Long userId,
                                    @AuthenticationPrincipal CurrentUser me) {
        Long actor = requireActor(me);
        teamMemberService.internalRemove(teamId, userId, actor);
        auditLogService.record(actor, "team_member.remove", "team_member", userId,
                payload(teamId, userId, null, null));
        return ApiResponse.ok();
    }

    private Long requireActor(CurrentUser me) {
        if (me == null || me.getId() == null) {
            throw new BusinessException(40100, "未登录");
        }
        return me.getId();
    }

    private static Map<String, Object> payload(Long teamId, Long userId, Object oldRole, Object newRole) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("teamId", teamId);
        p.put("userId", userId);
        if (oldRole != null) p.put("oldRole", oldRole);
        if (newRole != null) p.put("newRole", newRole);
        return p;
    }
}
```

- [ ] **Step 5：跑测试确认全部 PASS**

Run: `cd backend && mvn test -Dtest=AdminTeamMemberControllerTest`
Expected: 4 个 case PASS。如果 `update_role_to_owner_rejected` 因为 JSR-303 错误返回 200 + code≠0 而非 400，把断言改成：

```java
.andExpect(status().isOk())
.andExpect(jsonPath("$.code").value(40001));
```

按项目实际全局异常处理走（参照 `common/exception` 包里 `GlobalExceptionHandler` 对 `MethodArgumentNotValidException` 的处理）。

- [ ] **Step 6：commit**

```bash
git add backend/src/main/java/com/skillstack/admin/dto/AdminAddTeamMemberReq.java \
        backend/src/main/java/com/skillstack/admin/dto/AdminUpdateTeamMemberRoleReq.java \
        backend/src/main/java/com/skillstack/admin/controller/AdminTeamMemberController.java \
        backend/src/test/java/com/skillstack/admin/controller/AdminTeamMemberControllerTest.java
git commit -m "feat(admin): super-admin team member management endpoints"
```

---

## Task 3：admin PATCH /api/admin/teams/{id}（改 name / slug / status）

**Files:**
- Create: `backend/src/main/java/com/skillstack/admin/dto/AdminUpdateTeamReq.java`
- Modify: `backend/src/main/java/com/skillstack/admin/service/AdminTeamService.java`（追加 `updateBasic`）
- Modify: `backend/src/main/java/com/skillstack/admin/controller/AdminTeamController.java`（追加 PATCH 端点）
- Test: `backend/src/test/java/com/skillstack/admin/service/AdminTeamServicePatchTest.java`

- [ ] **Step 1：写 DTO**

`AdminUpdateTeamReq.java`：

```java
package com.skillstack.admin.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AdminUpdateTeamReq {
    @Size(min = 1, max = 60, message = "name 长度需在 1-60 之间")
    private String name;

    @Pattern(regexp = "[a-z0-9-]{2,40}", message = "slug 只允许小写字母/数字/-，长度 2-40")
    private String slug;

    @Pattern(regexp = "ACTIVE|DISABLED", message = "status 仅允许 ACTIVE 或 DISABLED")
    private String status;
}
```

- [ ] **Step 2：写失败的 service 测试**

`backend/src/test/java/com/skillstack/admin/service/AdminTeamServicePatchTest.java`：

```java
package com.skillstack.admin.service;

import com.skillstack.admin.dto.AdminTeamDetailVO;
import com.skillstack.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AdminTeamServicePatchTest {

    @Autowired AdminTeamService svc;

    private static final long TEAM_ID = 1L;
    private static final long OTHER_TEAM_ID = 2L;

    @Test
    void update_basic_name_only() {
        AdminTeamDetailVO before = svc.detail(TEAM_ID);
        svc.updateBasic(TEAM_ID, "Renamed Team", null);
        AdminTeamDetailVO after = svc.detail(TEAM_ID);
        assertEquals("Renamed Team", after.getName());
        assertEquals(before.getSlug(), after.getSlug()); // slug 不变
    }

    @Test
    void update_basic_slug_conflict() {
        String otherSlug = svc.detail(OTHER_TEAM_ID).getSlug();
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.updateBasic(TEAM_ID, null, otherSlug));
        assertEquals(40901, ex.getCode());
    }
}
```

- [ ] **Step 3：跑测试确认 FAIL**

Run: `cd backend && mvn test -Dtest=AdminTeamServicePatchTest`
Expected: 2 个 case FAIL（`updateBasic` 不存在）。

- [ ] **Step 4：在 `AdminTeamService` 末尾追加 `updateBasic`**

在 `backend/src/main/java/com/skillstack/admin/service/AdminTeamService.java` 末尾 `}` 之前插入：

```java
/**
 * 平台超管改团队基础字段。name 与 slug 都可为 null（表示不变），都不为 null 时同事务提交。
 * slug 唯一性在事务内 SELECT FOR UPDATE 之后再 UPDATE，避免竞态。
 * 返回旧值 map 供审计使用。
 */
@Transactional
public Map<String, Object> updateBasic(Long id, String name, String slug) {
    Team t = mustGet(id);
    Map<String, Object> changes = new LinkedHashMap<>();
    if (name != null) {
        String trimmed = name.trim();
        if (trimmed.isEmpty() || trimmed.length() > 60) {
            throw new BusinessException(40001, "name 长度需在 1-60 之间");
        }
        if (!trimmed.equals(t.getName())) {
            changes.put("name", Map.of("old", t.getName(), "new", trimmed));
            t.setName(trimmed);
        }
    }
    if (slug != null) {
        String s = slug.trim();
        if (!s.matches("[a-z0-9-]{2,40}")) {
            throw new BusinessException(40001, "slug 格式不合法");
        }
        if (!s.equals(t.getSlug())) {
            Long dup = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM teams WHERE slug = ? AND id <> ? AND deleted = 0",
                    Long.class, s, id);
            if (dup != null && dup > 0) {
                throw new BusinessException(40901, "slug 已被其他团队占用");
            }
            changes.put("slug", Map.of("old", t.getSlug(), "new", s));
            t.setSlug(s);
        }
    }
    if (!changes.isEmpty()) {
        adminTeamMapper.updateById(t);
    }
    changes.put("teamId", t.getId());
    return changes;
}
```

- [ ] **Step 5：跑测试确认 PASS**

Run: `cd backend && mvn test -Dtest=AdminTeamServicePatchTest`
Expected: 2 case PASS。

- [ ] **Step 6：在 `AdminTeamController` 追加 PATCH 端点**

在 `backend/src/main/java/com/skillstack/admin/controller/AdminTeamController.java` `@PostMapping("/{id}/enable")` 之后追加：

```java
@PatchMapping("/{id}")
public ApiResponse<Void> update(@PathVariable("id") Long id,
                                @Valid @RequestBody com.skillstack.admin.dto.AdminUpdateTeamReq req,
                                @AuthenticationPrincipal CurrentUser me) {
    Long actor = requireActor(me);
    if (req.getName() != null || req.getSlug() != null) {
        Map<String, Object> changes = adminTeamService.updateBasic(id, req.getName(), req.getSlug());
        if (changes.size() > 1) { // 不止 teamId
            auditLogService.record(actor, "team.update_basic", "team", id, changes);
        }
    }
    if (req.getStatus() != null) {
        if ("DISABLED".equals(req.getStatus())) {
            Map<String, Object> payload = adminTeamService.disable(id);
            auditLogService.record(actor, "team.disable", "team", id, payload);
        } else if ("ACTIVE".equals(req.getStatus())) {
            Map<String, Object> payload = adminTeamService.enable(id);
            auditLogService.record(actor, "team.enable", "team", id, payload);
        }
    }
    return ApiResponse.ok();
}
```

记得在文件 imports 区加 `import jakarta.validation.Valid;` 与 `import org.springframework.web.bind.annotation.PatchMapping;`。

- [ ] **Step 7：编译并跑全部 admin 测试**

Run: `cd backend && mvn -q -DskipTests compile && mvn test -Dtest='Admin*Test'`
Expected：全 PASS。

- [ ] **Step 8：commit**

```bash
git add backend/src/main/java/com/skillstack/admin/dto/AdminUpdateTeamReq.java \
        backend/src/main/java/com/skillstack/admin/service/AdminTeamService.java \
        backend/src/main/java/com/skillstack/admin/controller/AdminTeamController.java \
        backend/src/test/java/com/skillstack/admin/service/AdminTeamServicePatchTest.java
git commit -m "feat(admin): PATCH /api/admin/teams/{id} for name/slug/status"
```

---

## Task 4：前端 API 类型与 hooks

**Files:**
- Modify: `frontend/src/api/endpoints.ts`
- Modify: `frontend/src/api/admin.ts`

- [ ] **Step 1：在 `endpoints.ts` 追加类型**

在 `frontend/src/api/endpoints.ts` 文件末尾 `}` 之前，找到 `AdminTeamDetail` 附近的位置追加：

```ts
export interface AdminTeamMember {
  userId: number;
  handle: string;
  name: string;
  avatar?: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joined?: string;
  skills?: number;
  lastActive?: string;
}

export interface AdminUpdateTeamReq {
  name?: string;
  slug?: string;
  status?: 'ACTIVE' | 'DISABLED';
}

export interface AdminAddTeamMemberReq {
  userId: number;
  role: 'ADMIN' | 'MEMBER';
}

export interface AdminTeamMembersQuery {
  q?: string;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER' | '';
  page?: number;
  size?: number;
}
```

- [ ] **Step 2：在 `adminApi` 对象内追加 5 个 endpoint**

定位 `frontend/src/api/endpoints.ts` 第 837-840 行（`listTeams / teamDetail / disableTeam / enableTeam`）下方，追加：

```ts
  updateTeam: (id: number, body: AdminUpdateTeamReq) =>
    http.patch<unknown, void>(`/admin/teams/${id}`, body),
  listTeamMembers: (id: number, q: AdminTeamMembersQuery = {}) =>
    http.get<unknown, PageRes<AdminTeamMember>>(`/admin/teams/${id}/members`, { params: q }),
  addTeamMember: (id: number, body: AdminAddTeamMemberReq) =>
    http.post<unknown, void>(`/admin/teams/${id}/members`, body),
  updateTeamMemberRole: (id: number, userId: number, role: 'ADMIN' | 'MEMBER') =>
    http.put<unknown, void>(`/admin/teams/${id}/members/${userId}`, { role }),
  removeTeamMember: (id: number, userId: number) =>
    http.delete<unknown, void>(`/admin/teams/${id}/members/${userId}`),
```

- [ ] **Step 3：在 `admin.ts` 追加 hooks**

在 `frontend/src/api/admin.ts` `useEnableTeam` 之后追加：

```ts
export function useUpdateAdminTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: import('./endpoints').AdminUpdateTeamReq }) =>
      adminApi.updateTeam(id, body),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'team', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'teams'] });
    },
  });
}

export function useAdminTeamMembers(
  id: number | null | undefined,
  query: import('./endpoints').AdminTeamMembersQuery = {},
) {
  return useQuery({
    queryKey: ['admin', 'team-members', id, query],
    queryFn: () => adminApi.listTeamMembers(id as number, query),
    enabled: typeof id === 'number' && id > 0,
    staleTime: 15_000,
  });
}

function invalidateTeamMembers(qc: ReturnType<typeof useQueryClient>, id: number) {
  qc.invalidateQueries({ queryKey: ['admin', 'team-members', id] });
  qc.invalidateQueries({ queryKey: ['admin', 'team', id] });
  qc.invalidateQueries({ queryKey: ['admin', 'teams'] });
}

export function useAddAdminTeamMember(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: import('./endpoints').AdminAddTeamMemberReq) =>
      adminApi.addTeamMember(id, body),
    onSuccess: () => invalidateTeamMembers(qc, id),
  });
}

export function useUpdateAdminTeamMemberRole(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: 'ADMIN' | 'MEMBER' }) =>
      adminApi.updateTeamMemberRole(id, userId, role),
    onSuccess: () => invalidateTeamMembers(qc, id),
  });
}

export function useRemoveAdminTeamMember(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => adminApi.removeTeamMember(id, userId),
    onSuccess: () => invalidateTeamMembers(qc, id),
  });
}
```

- [ ] **Step 4：类型检查**

Run: `cd frontend && npm run lint`
Expected: 通过（即 `tsc -b --noEmit` 无错）。

- [ ] **Step 5：commit**

```bash
git add frontend/src/api/endpoints.ts frontend/src/api/admin.ts
git commit -m "feat(admin): add team detail / member management API hooks"
```

---

## Task 5：抽离表格样式 + TeamDetail 路由壳 + Overview Tab

**Files:**
- Create: `frontend/src/pages/admin/teamDetail/tableStyles.ts`
- Create: `frontend/src/pages/admin/TeamDetail.tsx`
- Create: `frontend/src/pages/admin/teamDetail/OverviewTab.tsx`
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/src/pages/admin/Teams.tsx`（详情按钮改 `navigate`）

- [ ] **Step 1：抽离公共表格样式**

`frontend/src/pages/admin/teamDetail/tableStyles.ts`：

```ts
import type { CSSProperties } from 'react';
import { TOKENS } from '@/lib/tokens';

export const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

export const thStyle: CSSProperties = {
  textAlign: 'left',
  fontWeight: 500,
  fontSize: 12,
  color: TOKENS.text3,
  padding: '8px 10px',
  borderBottom: `1px solid ${TOKENS.border}`,
};

export const tdStyle: CSSProperties = {
  padding: '12px 10px',
  verticalAlign: 'middle',
};

export const tdEmptyStyle: CSSProperties = {
  padding: '24px 10px',
  color: TOKENS.text3,
  textAlign: 'center',
  fontSize: 12.5,
};
```

- [ ] **Step 2：写 `OverviewTab`**

`frontend/src/pages/admin/teamDetail/OverviewTab.tsx`：

```tsx
import { TOKENS } from '@/lib/tokens';
import { Badge, Card } from '@/components/ui';
import type { AdminTeamDetail } from '@/api/endpoints';

interface Props {
  detail: AdminTeamDetail;
}

export function OverviewTab({ detail }: Props) {
  const isDisabled = detail.status === 'DISABLED';
  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      <Card pad={16}>
        <SectionTitle>基础信息</SectionTitle>
        <KV k="名称" v={detail.name} />
        <KV k="Slug" v={`/${detail.slug}`} />
        <KV
          k="状态"
          v={<Badge tone={isDisabled ? 'danger' : 'success'} size="sm">{isDisabled ? '已禁用' : '正常'}</Badge>}
        />
        <KV k="创建于" v={detail.createdAt ?? '—'} />
        <KV k="描述" v={detail.description || '—'} />
      </Card>

      <Card pad={16}>
        <SectionTitle>Owner</SectionTitle>
        <KV k="姓名" v={detail.ownerName ?? '—'} />
        <KV k="Handle" v={detail.ownerHandle ? `@${detail.ownerHandle}` : '—'} />
      </Card>

      <Card pad={16}>
        <SectionTitle>资产</SectionTitle>
        <KV k="成员" v={detail.membersCount ?? 0} />
        <KV k="Skill" v={detail.skillsCount ?? 0} />
        <KV k="套件" v={detail.suitesCount ?? 0} />
      </Card>

      <Card pad={16}>
        <SectionTitle>团队配置（只读）</SectionTitle>
        <KV k="审核模式" v={detail.reviewMode === 'AUTO' ? '自动通过' : '需要审核'} />
        <KV k="公开首页" v={detail.publicHome ? '是' : '否'} />
        <KV k="主色" v={detail.color ?? '—'} />
        <KV
          k="Logo"
          v={detail.logoUrl
            ? <img src={detail.logoUrl} alt="" style={{ height: 28, borderRadius: 4 }} />
            : '—'}
        />
      </Card>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: TOKENS.text3, marginBottom: 10, letterSpacing: 0.3 }}>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', fontSize: 13 }}>
      <div style={{ width: 80, color: TOKENS.text3 }}>{k}</div>
      <div style={{ flex: 1, color: TOKENS.text, wordBreak: 'break-all' }}>{v}</div>
    </div>
  );
}
```

- [ ] **Step 3：写 `TeamDetail.tsx` 壳（5 个 Tab，先只挂 Overview，其余 Tab 占位）**

`frontend/src/pages/admin/TeamDetail.tsx`：

```tsx
import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { Badge, Button, DashTopBar, EmptyState, toast } from '@/components/ui';
import { Tabs } from '@/components/chrome';
import { useAdminTeamDetail, useDisableTeam, useEnableTeam } from '@/api/admin';
import { AdminLayout } from './AdminLayout';
import { ConfirmDialog } from './_shared/ConfirmDialog';
import { OverviewTab } from './teamDetail/OverviewTab';
import { useState } from 'react';

const TAB_KEYS = ['overview', 'members', 'skills', 'suites', 'settings'] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default function AdminTeamDetailPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab: TabKey = useMemo(() => {
    const t = sp.get('tab') as TabKey | null;
    return (t && TAB_KEYS.includes(t)) ? t : 'overview';
  }, [sp]);

  const detailQuery = useAdminTeamDetail(Number.isFinite(id) ? id : undefined);
  const detail = detailQuery.data;
  const disableTeam = useDisableTeam();
  const enableTeam = useEnableTeam();
  const [confirmDisable, setConfirmDisable] = useState(false);

  if (!Number.isFinite(id)) {
    return (
      <AdminLayout active="teams">
        <DashTopBar title="团队不存在" />
        <div style={{ padding: 32 }}>
          <EmptyState title="无效的团队 id" actionLabel="返回列表" onAction={() => nav('/admin/teams')} />
        </div>
      </AdminLayout>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <AdminLayout active="teams">
        <DashTopBar title="加载中…" />
      </AdminLayout>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <AdminLayout active="teams">
        <DashTopBar title="团队不存在" />
        <div style={{ padding: 32 }}>
          <EmptyState title="团队不存在或已删除" actionLabel="返回列表" onAction={() => nav('/admin/teams')} />
        </div>
      </AdminLayout>
    );
  }

  const isDisabled = detail.status === 'DISABLED';

  return (
    <AdminLayout active="teams">
      <DashTopBar
        title={detail.name}
        hint={`@${detail.slug} · Owner ${detail.ownerHandle ? '@' + detail.ownerHandle : '—'}`}
        actions={
          <>
            <Badge tone={isDisabled ? 'danger' : 'success'} size="sm">
              {isDisabled ? '已禁用' : '正常'}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => nav('/admin/teams')}>返回列表</Button>
            <Button variant="ghost" size="sm" onClick={() => window.open(`/teams/${detail.slug}`, '_blank')}>
              公开页
            </Button>
            {isDisabled ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  enableTeam.mutate(id, {
                    onSuccess: () => toast({ kind: 'success', message: `已启用 ${detail.name}` }),
                    onError: (e) => toast({ kind: 'error', message: e instanceof Error ? e.message : '操作失败' }),
                  })
                }
              >
                启用
              </Button>
            ) : (
              <Button variant="danger" size="sm" onClick={() => setConfirmDisable(true)}>禁用</Button>
            )}
          </>
        }
      />
      <div style={{ background: '#fff', borderBottom: `1px solid ${TOKENS.border}`, padding: '0 32px' }}>
        <Tabs
          tabs={[
            { id: 'overview', label: '概览' },
            { id: 'members', label: '成员', count: detail.membersCount ?? 0 },
            { id: 'skills', label: 'Skill', count: detail.skillsCount ?? 0 },
            { id: 'suites', label: '套件', count: detail.suitesCount ?? 0 },
            { id: 'settings', label: '设置' },
          ]}
          active={tab}
          onChange={(t) => {
            sp.set('tab', t);
            setSp(sp, { replace: true });
          }}
        />
      </div>
      <div style={{ padding: '24px 32px 40px', overflow: 'auto' }}>
        {tab === 'overview' && <OverviewTab detail={detail} />}
        {tab === 'members' && <PendingTab name="成员" />}
        {tab === 'skills' && <PendingTab name="Skill" />}
        {tab === 'suites' && <PendingTab name="套件" />}
        {tab === 'settings' && <PendingTab name="设置" />}
      </div>

      <ConfirmDialog
        open={confirmDisable}
        title={`禁用团队 ${detail.name}？`}
        description="禁用后团队成员仍可登录，但无法创建/编辑/发布 skill 与套件，公开广场也不再展示该团队内容。"
        danger
        loading={disableTeam.isPending}
        onConfirm={() => {
          disableTeam.mutate(id, {
            onSuccess: () => {
              toast({ kind: 'success', message: `已禁用 ${detail.name}` });
              setConfirmDisable(false);
            },
            onError: (e) => toast({ kind: 'error', message: e instanceof Error ? e.message : '操作失败' }),
          });
        }}
        onCancel={() => setConfirmDisable(false)}
      />
    </AdminLayout>
  );
}

function PendingTab({ name }: { name: string }) {
  return (
    <div style={{ padding: 24, color: TOKENS.text3, fontSize: 13 }}>
      {name} Tab 待实现
    </div>
  );
}
```

- [ ] **Step 4：注册路由**

`frontend/src/router.tsx` 在第 148 行（`/admin/teams` 行）之后追加：

```tsx
  { path: '/admin/teams/:id', element: <RequireSuperAdmin><AdminTeamDetailPage /></RequireSuperAdmin> },
```

并在文件 import 区追加：

```tsx
import AdminTeamDetailPage from '@/pages/admin/TeamDetail';
```

- [ ] **Step 5：修改 Teams.tsx 详情按钮**

`frontend/src/pages/admin/Teams.tsx` 第 1 行的 imports 追加：

```tsx
import { useNavigate } from 'react-router-dom';
```

在组件函数顶部追加 `const nav = useNavigate();`。

把第 144-152 行（操作单元格里的 `详情` 按钮 + `启用 / 禁用` 按钮组）改为：

```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => nav(`/admin/teams/${t.id}`)}
>
  详情
</Button>
<Button
  variant="ghost"
  size="sm"
  onClick={() => window.open(`/teams/${t.slug}`, '_blank')}
>
  公开页
</Button>
```

保留下方启用/禁用按钮不变。

- [ ] **Step 6：类型检查 + 启动 dev server 手动 smoke**

Run: `cd frontend && npm run lint`
Expected: PASS。

服务侧需要后端在跑（`./scripts/services.sh start`），手动打开 `http://localhost:5173/admin/teams`，进入任一团队详情，确认 Overview 卡片正常渲染。

- [ ] **Step 7：commit**

```bash
git add frontend/src/pages/admin/TeamDetail.tsx \
        frontend/src/pages/admin/teamDetail/OverviewTab.tsx \
        frontend/src/pages/admin/teamDetail/tableStyles.ts \
        frontend/src/router.tsx \
        frontend/src/pages/admin/Teams.tsx
git commit -m "feat(admin): team detail page shell with overview tab"
```

---

## Task 6：Members Tab（含表格 / 改角色 / 踢出）

**Files:**
- Create: `frontend/src/pages/admin/teamDetail/MembersTab.tsx`
- Modify: `frontend/src/pages/admin/TeamDetail.tsx`（挂载 MembersTab）

- [ ] **Step 1：写 `MembersTab.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  toast,
} from '@/components/ui';
import { I } from '@/components/icons';
import {
  useAdminTeamMembers,
  useRemoveAdminTeamMember,
  useUpdateAdminTeamMemberRole,
} from '@/api/admin';
import type { AdminTeamMember } from '@/api/endpoints';
import { ConfirmDialog } from '../_shared/ConfirmDialog';
import { Pagination } from '../_shared/Pagination';
import { tableStyle, thStyle, tdStyle, tdEmptyStyle } from './tableStyles';
import { AddMemberDialog } from './AddMemberDialog';

const PAGE_SIZE = 20;

interface Props {
  teamId: number;
  teamName: string;
}

type Confirm =
  | { kind: 'kick'; member: AdminTeamMember }
  | { kind: 'role'; member: AdminTeamMember; nextRole: 'ADMIN' | 'MEMBER' };

export function MembersTab({ teamId, teamName }: Props) {
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [role, setRole] = useState<'' | 'OWNER' | 'ADMIN' | 'MEMBER'>('');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const listQuery = useAdminTeamMembers(teamId, {
    q: q || undefined,
    role: role || undefined,
    page,
    size: PAGE_SIZE,
  });
  const items: AdminTeamMember[] = useMemo(
    () => listQuery.data?.items ?? listQuery.data?.records ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.total ?? 0;

  const updateRole = useUpdateAdminTeamMemberRole(teamId);
  const removeMember = useRemoveAdminTeamMember(teamId);

  const submitSearch = () => {
    setPage(1);
    setQ(searchInput.trim());
  };

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === 'kick') {
      removeMember.mutate(confirm.member.userId, {
        onSuccess: () => {
          toast({ kind: 'success', message: `已移除 @${confirm.member.handle}` });
          setConfirm(null);
        },
        onError: (e) =>
          toast({ kind: 'error', message: e instanceof Error ? e.message : '操作失败' }),
      });
    } else {
      updateRole.mutate(
        { userId: confirm.member.userId, role: confirm.nextRole },
        {
          onSuccess: () => {
            toast({ kind: 'success', message: `已把 @${confirm.member.handle} 改为 ${confirm.nextRole}` });
            setConfirm(null);
          },
          onError: (e) =>
            toast({ kind: 'error', message: e instanceof Error ? e.message : '操作失败' }),
        },
      );
    }
  };

  return (
    <Card pad={16}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input
          placeholder="搜索 handle / 姓名"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitSearch();
          }}
          style={{ width: 240 }}
        />
        <Button variant="secondary" size="sm" onClick={submitSearch}>
          <I.search size={13} /> 搜索
        </Button>
        <Select
          value={role}
          onChange={(e) => {
            setPage(1);
            setRole(e.target.value as typeof role);
          }}
          style={{ width: 'auto', height: 34, padding: '0 30px 0 10px', fontSize: 13 }}
          options={[
            { value: '', label: '全部角色' },
            { value: 'OWNER', label: 'Owner' },
            { value: 'ADMIN', label: 'Admin' },
            { value: 'MEMBER', label: 'Member' },
          ]}
        />
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            <I.plus size={12} /> 添加成员
          </Button>
        </div>
      </div>

      <div style={{ marginTop: 16, overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>成员</th>
              <th style={thStyle}>角色</th>
              <th style={thStyle}>加入</th>
              <th style={thStyle}>最近活动</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {listQuery.isLoading ? (
              <tr><td colSpan={5} style={tdEmptyStyle}>加载中…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} style={tdEmptyStyle}><EmptyState compact title="没有匹配的成员" /></td></tr>
            ) : (
              items.map((m) => {
                const isOwner = m.role === 'OWNER';
                return (
                  <tr key={m.userId} style={{ borderTop: `1px solid ${TOKENS.borderSoft}` }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={m.name} char={(m.name || m.handle || 'U').slice(0, 1)} size={28} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name || m.handle}</div>
                          <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>@{m.handle}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <Badge tone={isOwner ? 'primary' : m.role === 'ADMIN' ? 'info' : 'neutral'} size="sm">
                        {m.role}
                      </Badge>
                    </td>
                    <td style={tdStyle}>{m.joined ?? '—'}</td>
                    <td style={tdStyle}>{m.lastActive ?? '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Select
                          value={m.role === 'ADMIN' ? 'ADMIN' : 'MEMBER'}
                          disabled={isOwner}
                          onChange={(e) => {
                            const next = e.target.value as 'ADMIN' | 'MEMBER';
                            if (next !== m.role) {
                              setConfirm({ kind: 'role', member: m, nextRole: next });
                            }
                          }}
                          style={{ width: 100, height: 30, padding: '0 26px 0 8px', fontSize: 12.5 }}
                          options={[
                            { value: 'ADMIN', label: 'Admin' },
                            { value: 'MEMBER', label: 'Member' },
                          ]}
                          title={isOwner ? '请先在团队侧转让 Owner' : undefined}
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isOwner}
                          title={isOwner ? '请先在团队侧转让 Owner' : undefined}
                          onClick={() => setConfirm({ kind: 'kick', member: m })}
                        >
                          踢出
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} size={PAGE_SIZE} total={total} onChange={setPage} />

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.kind === 'kick'
            ? `将 @${confirm.member.handle} 从 ${teamName} 移除？`
            : confirm?.kind === 'role'
              ? `把 @${confirm.member.handle} 改为 ${confirm.nextRole}？`
              : ''
        }
        description={
          confirm?.kind === 'kick'
            ? '此操作会立即生效。被移除成员的所有 PAT 不会自动吊销，团队管理员可后续清理。'
            : confirm?.kind === 'role'
              ? '角色变更后会通过站内信告知该成员。'
              : undefined
        }
        danger={confirm?.kind === 'kick'}
        loading={updateRole.isPending || removeMember.isPending}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />

      <AddMemberDialog
        open={addOpen}
        teamId={teamId}
        teamName={teamName}
        onClose={() => setAddOpen(false)}
      />
    </Card>
  );
}
```

- [ ] **Step 2：在 `TeamDetail.tsx` 挂载**

把 `TeamDetail.tsx` 里 `{tab === 'members' && <PendingTab name="成员" />}` 改为：

```tsx
{tab === 'members' && <MembersTab teamId={id} teamName={detail.name} />}
```

并在 imports 区追加：

```tsx
import { MembersTab } from './teamDetail/MembersTab';
```

- [ ] **Step 3：类型检查**

`AddMemberDialog` 还没创建，会触发 TS 报错。继续 Task 7。

---

## Task 7：AddMemberDialog（按用户搜索后加入）

**Files:**
- Create: `frontend/src/pages/admin/teamDetail/AddMemberDialog.tsx`

- [ ] **Step 1：写组件**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import { Avatar, Button, Input, Select, toast } from '@/components/ui';
import { I } from '@/components/icons';
import { useAdminUsers, useAddAdminTeamMember } from '@/api/admin';
import type { AdminUserListItem } from '@/api/endpoints';

interface Props {
  open: boolean;
  teamId: number;
  teamName: string;
  onClose: () => void;
}

export function AddMemberDialog({ open, teamId, teamName, onClose }: Props) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<AdminUserListItem | null>(null);
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) {
      setQ(''); setDebounced(''); setPicked(null); setRole('MEMBER');
    }
  }, [open]);

  const listQuery = useAdminUsers(debounced.length >= 1 ? { q: debounced, size: 8 } : {});
  const items = useMemo(
    () => (debounced ? (listQuery.data?.items ?? listQuery.data?.records ?? []) : []),
    [listQuery.data, debounced],
  );

  const add = useAddAdminTeamMember(teamId);

  if (!open) return null;

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>添加成员到 {teamName}</div>

        <div style={{ position: 'relative' }}>
          <Input
            autoFocus
            placeholder="搜 handle / 姓名 / 邮箱 / 手机号"
            value={q}
            onChange={(e) => { setPicked(null); setQ(e.target.value); }}
            style={{ width: '100%' }}
          />
          {debounced && !picked && (
            <div style={dropdown}>
              {listQuery.isLoading ? (
                <div style={dropdownEmpty}>搜索中…</div>
              ) : items.length === 0 ? (
                <div style={dropdownEmpty}>没有匹配的用户</div>
              ) : (
                items.map((u) => (
                  <div
                    key={u.id}
                    style={dropdownItem}
                    onClick={() => { setPicked(u); setQ(`${u.name} (@${u.handle})`); }}
                  >
                    <Avatar name={u.name} char={(u.name || u.handle || 'U').slice(0, 1)} size={24} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name || u.handle}</div>
                      <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>
                        @{u.handle} · {u.email || '—'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <span style={{ fontSize: 12, color: TOKENS.text3 }}>角色</span>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')}
            style={{ width: 140, height: 32, padding: '0 28px 0 10px', fontSize: 13 }}
            options={[
              { value: 'MEMBER', label: 'Member' },
              { value: 'ADMIN', label: 'Admin' },
            ]}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!picked || add.isPending}
            onClick={() => {
              if (!picked) return;
              add.mutate(
                { userId: picked.id, role },
                {
                  onSuccess: () => {
                    toast({ kind: 'success', message: `已加入 @${picked.handle}` });
                    onClose();
                  },
                  onError: (e) =>
                    toast({ kind: 'error', message: e instanceof Error ? e.message : '操作失败' }),
                },
              );
            }}
          >
            <I.plus size={12} /> 加入
          </Button>
        </div>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)',
  display: 'grid', placeItems: 'center', zIndex: 60,
};
const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 10, padding: 20, width: 460, maxWidth: '90vw',
  boxShadow: '0 10px 30px rgba(15,23,42,.18)',
};
const dropdown: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
  background: '#fff', border: `1px solid ${TOKENS.border}`, borderRadius: 8,
  boxShadow: '0 6px 20px rgba(15,23,42,.08)', maxHeight: 280, overflow: 'auto', zIndex: 1,
};
const dropdownItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', cursor: 'pointer',
};
const dropdownEmpty: React.CSSProperties = {
  padding: '12px', fontSize: 12, color: TOKENS.text3, textAlign: 'center',
};
```

- [ ] **Step 2：类型检查**

Run: `cd frontend && npm run lint`
Expected: PASS。

- [ ] **Step 3：commit Members Tab + AddMemberDialog**

```bash
git add frontend/src/pages/admin/teamDetail/MembersTab.tsx \
        frontend/src/pages/admin/teamDetail/AddMemberDialog.tsx \
        frontend/src/pages/admin/TeamDetail.tsx
git commit -m "feat(admin): team detail members tab with role/kick/add"
```

---

## Task 8：Skills Tab + Suites Tab（只读复用）

**Files:**
- Create: `frontend/src/pages/admin/teamDetail/SkillsTab.tsx`
- Create: `frontend/src/pages/admin/teamDetail/SuitesTab.tsx`
- Modify: `frontend/src/pages/admin/TeamDetail.tsx`

- [ ] **Step 1：写 `SkillsTab.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import { Badge, Card, EmptyState } from '@/components/ui';
import { useAdminSkills } from '@/api/admin';
import { Pagination } from '../_shared/Pagination';
import { tableStyle, thStyle, tdStyle, tdEmptyStyle } from './tableStyles';

const PAGE_SIZE = 20;

export function SkillsTab({ teamId, teamSlug }: { teamId: number; teamSlug: string }) {
  const [page, setPage] = useState(1);
  const query = useAdminSkills({ teamId, page, size: PAGE_SIZE });
  const items = useMemo(() => query.data?.items ?? query.data?.records ?? [], [query.data]);
  const total = query.data?.total ?? 0;

  return (
    <Card pad={16}>
      <div style={{ marginTop: 4, overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Skill</th>
              <th style={thStyle}>可见性</th>
              <th style={thStyle}>状态</th>
              <th style={thStyle}>版本</th>
              <th style={thStyle}>下载</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr><td colSpan={5} style={tdEmptyStyle}>加载中…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} style={tdEmptyStyle}><EmptyState compact title="该团队没有 Skill" /></td></tr>
            ) : (
              items.map((s: any) => (
                <tr key={s.id} style={{ borderTop: `1px solid ${TOKENS.borderSoft}` }}>
                  <td style={tdStyle}>
                    <a
                      href={`/teams/${teamSlug}/skills/${s.slug ?? s.id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}
                    >
                      {s.name}
                    </a>
                    <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>{s.slug ?? ''}</div>
                  </td>
                  <td style={tdStyle}>
                    <Badge tone={s.visibility === 'PUBLIC' ? 'success' : 'neutral'} size="sm">
                      {s.visibility ?? '—'}
                    </Badge>
                  </td>
                  <td style={tdStyle}>{s.status ?? '—'}</td>
                  <td style={tdStyle}>{s.versionsCount ?? 0}</td>
                  <td style={tdStyle}>{s.downloads ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} size={PAGE_SIZE} total={total} onChange={setPage} />
    </Card>
  );
}
```

> 字段名（visibility / status / versionsCount / downloads / slug）参照 `AdminSkillListItem` 当前实际定义。若实际字段名不同，按 `frontend/src/api/endpoints.ts` 里 `AdminSkillListItem` 定义对齐。

- [ ] **Step 2：写 `SuitesTab.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import { Card, EmptyState } from '@/components/ui';
import { useAdminSuites } from '@/api/admin';
import { Pagination } from '../_shared/Pagination';
import { tableStyle, thStyle, tdStyle, tdEmptyStyle } from './tableStyles';

const PAGE_SIZE = 20;

export function SuitesTab({ teamId, teamSlug }: { teamId: number; teamSlug: string }) {
  const [page, setPage] = useState(1);
  const query = useAdminSuites({ teamId, page, size: PAGE_SIZE });
  const items = useMemo(() => query.data?.items ?? query.data?.records ?? [], [query.data]);
  const total = query.data?.total ?? 0;

  return (
    <Card pad={16}>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>套件</th>
              <th style={thStyle}>包含 Skill</th>
              <th style={thStyle}>下载</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr><td colSpan={3} style={tdEmptyStyle}>加载中…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={3} style={tdEmptyStyle}><EmptyState compact title="该团队没有套件" /></td></tr>
            ) : (
              items.map((s: any) => (
                <tr key={s.id} style={{ borderTop: `1px solid ${TOKENS.borderSoft}` }}>
                  <td style={tdStyle}>
                    <a
                      href={`/teams/${teamSlug}/suites/${s.slug ?? s.id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}
                    >
                      {s.name}
                    </a>
                    <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>{s.slug ?? ''}</div>
                  </td>
                  <td style={tdStyle}>{s.skillsCount ?? 0}</td>
                  <td style={tdStyle}>{s.downloads ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} size={PAGE_SIZE} total={total} onChange={setPage} />
    </Card>
  );
}
```

- [ ] **Step 3：在 `TeamDetail.tsx` 挂载**

把 `{tab === 'skills' && <PendingTab name="Skill" />}` 与 `{tab === 'suites' && <PendingTab name="套件" />}` 改为：

```tsx
{tab === 'skills' && <SkillsTab teamId={id} teamSlug={detail.slug} />}
{tab === 'suites' && <SuitesTab teamId={id} teamSlug={detail.slug} />}
```

imports 追加：

```tsx
import { SkillsTab } from './teamDetail/SkillsTab';
import { SuitesTab } from './teamDetail/SuitesTab';
```

- [ ] **Step 4：类型检查**

Run: `cd frontend && npm run lint`
Expected：PASS。如果 `AdminSkillListItem` 字段名与上面 `any` 占位的字段不一致，把 `any` 换成对应类型并在表格里读对应字段。

- [ ] **Step 5：commit**

```bash
git add frontend/src/pages/admin/teamDetail/SkillsTab.tsx \
        frontend/src/pages/admin/teamDetail/SuitesTab.tsx \
        frontend/src/pages/admin/TeamDetail.tsx
git commit -m "feat(admin): team detail skills & suites tabs"
```

---

## Task 9：Settings Tab（name/slug/status 表单 + 只读区）

**Files:**
- Create: `frontend/src/pages/admin/teamDetail/SettingsTab.tsx`
- Modify: `frontend/src/pages/admin/TeamDetail.tsx`

- [ ] **Step 1：写 `SettingsTab.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import { Button, Card, Input, Select, toast } from '@/components/ui';
import { useUpdateAdminTeam } from '@/api/admin';
import type { AdminTeamDetail } from '@/api/endpoints';

interface Props {
  detail: AdminTeamDetail;
}

const SLUG_RE = /^[a-z0-9-]{2,40}$/;

export function SettingsTab({ detail }: Props) {
  const [name, setName] = useState(detail.name ?? '');
  const [slug, setSlug] = useState(detail.slug ?? '');
  const [status, setStatus] = useState<'ACTIVE' | 'DISABLED'>(
    detail.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
  );

  useEffect(() => {
    setName(detail.name ?? '');
    setSlug(detail.slug ?? '');
    setStatus(detail.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE');
  }, [detail.id, detail.name, detail.slug, detail.status]);

  const update = useUpdateAdminTeam();

  const nameValid = name.trim().length >= 1 && name.trim().length <= 60;
  const slugValid = SLUG_RE.test(slug.trim());
  const dirty =
    name.trim() !== (detail.name ?? '') ||
    slug.trim() !== (detail.slug ?? '') ||
    status !== (detail.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE');

  const onSubmit = () => {
    if (!nameValid || !slugValid) return;
    const body: { name?: string; slug?: string; status?: 'ACTIVE' | 'DISABLED' } = {};
    if (name.trim() !== detail.name) body.name = name.trim();
    if (slug.trim() !== detail.slug) body.slug = slug.trim();
    if (status !== (detail.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE')) body.status = status;
    if (Object.keys(body).length === 0) return;
    update.mutate(
      { id: detail.id!, body },
      {
        onSuccess: () => toast({ kind: 'success', message: '已保存' }),
        onError: (e) => toast({ kind: 'error', message: e instanceof Error ? e.message : '保存失败' }),
      },
    );
  };

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <Card pad={16}>
        <div style={{ fontSize: 12, color: TOKENS.text3, marginBottom: 10 }}>平台可改字段</div>
        <Field label="名称">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          {!nameValid && <Hint danger>长度需在 1-60 之间</Hint>}
        </Field>
        <Field label="Slug">
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          {!slugValid && <Hint danger>仅小写字母 / 数字 / -，长度 2-40</Hint>}
        </Field>
        <Field label="状态">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'DISABLED')}
            style={{ width: 160, height: 34, padding: '0 30px 0 10px', fontSize: 13 }}
            options={[
              { value: 'ACTIVE', label: '正常' },
              { value: 'DISABLED', label: '已禁用' },
            ]}
          />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Button
            variant="primary"
            size="sm"
            disabled={!dirty || !nameValid || !slugValid || update.isPending}
            onClick={onSubmit}
          >
            保存
          </Button>
        </div>
      </Card>

      <Card pad={16}>
        <div style={{ fontSize: 12, color: TOKENS.text3, marginBottom: 10 }}>
          团队自治字段（只读，团队 Owner / Admin 自行维护）
        </div>
        <ReadKV k="审核模式" v={detail.reviewMode === 'AUTO' ? '自动通过' : '需要审核'} />
        <ReadKV k="公开首页" v={detail.publicHome ? '是' : '否'} />
        <ReadKV k="描述" v={detail.description || '—'} />
        <ReadKV k="Logo URL" v={detail.logoUrl || '—'} />
        <ReadKV k="主色" v={detail.color || '—'} />
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: TOKENS.text3, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function Hint({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div style={{ fontSize: 11.5, color: danger ? TOKENS.danger : TOKENS.text3, marginTop: 4 }}>
      {children}
    </div>
  );
}

function ReadKV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', fontSize: 13 }}>
      <div style={{ width: 80, color: TOKENS.text3 }}>{k}</div>
      <div style={{ flex: 1, color: TOKENS.text, wordBreak: 'break-all' }}>{v}</div>
    </div>
  );
}
```

- [ ] **Step 2：在 `TeamDetail.tsx` 挂载**

把 `{tab === 'settings' && <PendingTab name="设置" />}` 改为：

```tsx
{tab === 'settings' && <SettingsTab detail={detail} />}
```

imports 追加：

```tsx
import { SettingsTab } from './teamDetail/SettingsTab';
```

并删除 `PendingTab` 函数与对应的 import（已无用）。

- [ ] **Step 3：类型检查 + 构建**

Run: `cd frontend && npm run lint && npm run build`
Expected: PASS。

- [ ] **Step 4：commit**

```bash
git add frontend/src/pages/admin/teamDetail/SettingsTab.tsx \
        frontend/src/pages/admin/TeamDetail.tsx
git commit -m "feat(admin): team detail settings tab"
```

---

## Task 10：端到端验证

**Files:** （无新增，仅运行验证）

- [ ] **Step 1：后端全量测试**

Run: `cd backend && mvn test`
Expected: 全 PASS（重点：team 包原有测试 + 新增 `AdminTeamMemberControllerTest` + `AdminTeamServicePatchTest`）。

- [ ] **Step 2：前端类型检查 + 构建**

Run: `cd frontend && npm run lint && npm run build`
Expected: 全 PASS。

- [ ] **Step 3：本地启动并 smoke check**

```bash
./scripts/services.sh start
```

打开浏览器 `http://localhost:5173`，以超管账号登录，执行：

1. 访问 `/admin/teams`，点击任一团队的"详情"，确认进入 `/admin/teams/:id?tab=overview`。
2. 切到"成员"Tab：能看到成员列表，搜索 / 角色过滤、改角色（confirm）、踢出（confirm）、添加成员（搜索 → 选择 → 选角色 → 加入）。
3. 切到"Skill" / "套件"Tab：能看到该团队 skill / 套件，点击跳公开页正常。
4. 切到"设置"Tab：改 name 保存成功；改 slug 保存成功；slug 输入已被其他团队占用的值 → 报错 toast；切 status → 整页 header badge 同步。
5. 顶部"禁用 / 启用"按钮工作正常。
6. URL 加 `?tab=members` 刷新页面，能直接进 members tab。
7. 访问 `/admin/teams/999999`（不存在的 id）→ Empty 提示 + 返回按钮可用。

- [ ] **Step 4：commit smoke notes（可选）**

如果 smoke 中发现需要修复的小问题，直接修，commit 信息按 `fix(admin): ...` 写。如果一切 OK，无需 commit。

---

## Self-Review 记录

- **Spec 覆盖**：成员可见性 → Task 6；改成员 → Task 1+2+6+7；看团队设置 → Task 5+9；改 name/slug/status → Task 3+9；Skill 可见 → Task 8；用户详情留待后续 → 文档已注明，不在本计划。
- **类型一致性**：`AdminUpdateTeamReq`、`AdminAddTeamMemberReq`、`AdminUpdateTeamMemberRoleReq`、`AdminTeamMember`、`AdminTeamMembersQuery` 在前端 `endpoints.ts` 定义，被 `admin.ts` hooks 与 Tab 组件直接 import；后端 DTO 名称与字段一致。
- **方法签名**：`internalUpdateRole(teamId, userId, role, operatorId)` / `internalRemove(teamId, userId, operatorId)` 在 Task 1 定义，Task 2 controller 调用时签名完全一致。
- **占位词**：plan 内无 TBD/TODO；唯一标注"按实际定义对齐"的地方是 Skill 字段名（Task 8 Step 1），因为 `AdminSkillListItem` 形状最终以现仓库定义为准，执行时按真实字段读取即可。
