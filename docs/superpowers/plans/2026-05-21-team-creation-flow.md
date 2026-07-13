# Team Creation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让无团队用户能在 `/team/create` 页面填写团队名称，一键创建团队并自动成为 OWNER，完成后跳转到 `/team`。

**Architecture:** 后端新增 `POST /api/teams`（仅需登录）；Service 层生成唯一 slug、写 `teams` + `team_members` 两张表；前端新增 `/team/create` 独立页面，简单表单（名称输入 + slug 只读预览），成功后 invalidate session 缓存并跳转；`NoTeamPage` 的"创建团队"按钮改为导航到 `/team/create`。

**Tech Stack:** Java 17 / Spring Boot 3.2 / MyBatis Plus；React 18 / TanStack Query / React Router / Tailwind-free inline styles（与现有页面一致）

---

## File Map

| 操作 | 路径 |
|---|---|
| 新建 | `backend/src/main/java/com/skillstack/team/dto/CreateTeamReq.java` |
| 修改 | `backend/src/main/java/com/skillstack/team/service/TeamService.java` |
| 修改 | `backend/src/main/java/com/skillstack/team/controller/TeamController.java` |
| 修改 | `backend/src/test/java/com/skillstack/team/service/TeamServiceTest.java` |
| 修改 | `frontend/src/api/endpoints.ts` |
| 新建 | `frontend/src/pages/team/CreateTeamPage.tsx` |
| 修改 | `frontend/src/router.tsx` |
| 修改 | `frontend/src/pages/team/NoTeamPage.tsx` |

---

## Task 1: 后端 DTO — CreateTeamReq

**Files:**
- Create: `backend/src/main/java/com/skillstack/team/dto/CreateTeamReq.java`

- [ ] **Step 1: 创建 DTO 文件**

```java
package com.skillstack.team.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateTeamReq {
    @NotBlank(message = "团队名称不能为空")
    @Size(min = 2, max = 64, message = "团队名称长度 2-64")
    private String name;
}
```

- [ ] **Step 2: 编译验证**

```bash
cd backend && mvn -q -DskipTests compile
```

期望：无报错输出。

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/skillstack/team/dto/CreateTeamReq.java
git commit -m "feat(team): add CreateTeamReq DTO"
```

---

## Task 2: 后端 Service — createTeam + generateUniqueSlug

**Files:**
- Modify: `backend/src/main/java/com/skillstack/team/service/TeamService.java`
- Test: `backend/src/test/java/com/skillstack/team/service/TeamServiceTest.java`

- [ ] **Step 1: 写失败测试**

在 `TeamServiceTest.java` 末尾、最后一个 `}` 前添加：

```java
// ==================== createTeam Tests ====================

@Test
void createTeam_createsTeamAndOwnerMember() {
    Long userId = 42L;
    String name = "My Team";

    // 没有 slug 冲突
    when(teamMapper.selectCount(any())).thenReturn(0L);
    when(teamMapper.insert(any())).thenAnswer(inv -> {
        Team t = inv.getArgument(0);
        t.setId(1L);
        return 1;
    });
    when(teamMemberMapper.insert(any())).thenReturn(1);

    var res = teamService.createTeam(userId, name);

    assertNotNull(res);
    assertEquals("My Team", res.getName());
    assertEquals("my-team", res.getSlug());

    // 验证 team_members 写入了 OWNER
    var memberCaptor = org.mockito.ArgumentCaptor.forClass(TeamMember.class);
    verify(teamMemberMapper).insert(memberCaptor.capture());
    assertEquals("OWNER", memberCaptor.getValue().getRole());
    assertEquals(userId, memberCaptor.getValue().getUserId());
}

@Test
void createTeam_slugCollision_appendsCounter() {
    Long userId = 1L;

    // 第一次 selectCount 返回 1（冲突），第二次返回 0（可用）
    when(teamMapper.selectCount(any()))
            .thenReturn(1L)
            .thenReturn(0L);
    when(teamMapper.insert(any())).thenAnswer(inv -> {
        Team t = inv.getArgument(0);
        t.setId(2L);
        return 1;
    });
    when(teamMemberMapper.insert(any())).thenReturn(1);

    var res = teamService.createTeam(userId, "My Team");

    assertEquals("my-team-1", res.getSlug());
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd backend && mvn test -pl . -Dtest=TeamServiceTest#createTeam_createsTeamAndOwnerMember,TeamServiceTest#createTeam_slugCollision_appendsCounter -q 2>&1 | tail -10
```

期望：`BUILD FAILURE`，提示 `createTeam` 方法不存在。

- [ ] **Step 3: 在 TeamService.java 中实现 createTeam**

在 `TeamService.java` 顶部 import 块添加（已有的不要重复）：

```java
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
```

在 `TeamService` 类内、`updateSettings` 方法前插入：

```java
@Transactional
public TeamDetailRes createTeam(Long userId, String name) {
    String slug = generateUniqueSlug(name);

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
}

private String generateUniqueSlug(String name) {
    String base = name.toLowerCase()
            .replaceAll("[^a-z0-9\\s-]", "")
            .trim()
            .replaceAll("\\s+", "-")
            .replaceAll("-{2,}", "-");
    if (base.isEmpty()) base = "team";
    if (base.length() > 48) base = base.substring(0, 48);

    String slug = base;
    int i = 1;
    while (teamMapper.selectCount(new LambdaQueryWrapper<Team>().eq(Team::getSlug, slug)) > 0) {
        slug = base + "-" + i++;
    }
    return slug;
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
cd backend && mvn test -pl . -Dtest=TeamServiceTest -q 2>&1 | tail -5
```

期望：`BUILD SUCCESS`，所有 `TeamServiceTest` 测试通过。

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/skillstack/team/service/TeamService.java \
        backend/src/test/java/com/skillstack/team/service/TeamServiceTest.java
git commit -m "feat(team): implement createTeam with unique slug generation"
```

---

## Task 3: 后端 Controller — POST /api/teams

**Files:**
- Modify: `backend/src/main/java/com/skillstack/team/controller/TeamController.java`

`POST /api/teams` 命中 SecurityConfig 的 `anyRequest().authenticated()`，无需修改 SecurityConfig。

- [ ] **Step 1: 在 TeamController.java 添加 import 和端点**

在已有 import 列表中添加（如未存在）：

```java
import com.skillstack.team.dto.CreateTeamReq;
```

在 `mine()` 方法前插入新端点：

```java
/** 创建团队，调用者自动成为 OWNER。 */
@PostMapping
public ApiResponse<TeamDetailRes> create(@AuthenticationPrincipal CurrentUser me,
                                          @Valid @RequestBody CreateTeamReq req) {
    return ApiResponse.ok(teamService.createTeam(me.getId(), req.getName()));
}
```

- [ ] **Step 2: 编译验证**

```bash
cd backend && mvn -q -DskipTests compile
```

期望：无报错输出。

- [ ] **Step 3: 运行全量测试**

```bash
cd backend && mvn test -q 2>&1 | tail -5
```

期望：`BUILD SUCCESS`。

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/skillstack/team/controller/TeamController.java
git commit -m "feat(team): add POST /api/teams endpoint"
```

---

## Task 4: 前端 API — teamApi.create

**Files:**
- Modify: `frontend/src/api/endpoints.ts`

- [ ] **Step 1: 在 teamApi 对象内添加 create 方法**

找到 `endpoints.ts` 中 `teamApi` 的第一个方法 `publicList` 前，在 `{` 后插入：

```ts
  create: (name: string) => http.post<unknown, { id: number; slug: string; name: string }>('/teams', { name }),
```

完整的 `teamApi` 开头应为：

```ts
export const teamApi = {
  create: (name: string) => http.post<unknown, { id: number; slug: string; name: string }>('/teams', { name }),
  publicList: () => http.get<unknown, Team[]>('/teams'),
  // ...其余方法不变
```

- [ ] **Step 2: 类型检查**

```bash
cd frontend && npm run lint 2>&1 | tail -10
```

期望：无类型错误。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/endpoints.ts
git commit -m "feat(team): add teamApi.create endpoint"
```

---

## Task 5: 前端页面 — CreateTeamPage

**Files:**
- Create: `frontend/src/pages/team/CreateTeamPage.tsx`

- [ ] **Step 1: 创建页面文件**

```tsx
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Button } from '@/components/atoms';
import { TopBar } from '@/components/chrome';
import { I } from '@/components/icons';
import { getToken } from '@/api/client';
import { teamApi } from '@/api/endpoints';

function toSlugPreview(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 48);
  return base || 'team';
}

export default function CreateTeamPage() {
  if (!getToken()) return <Navigate to="/login" replace />;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const slugPreview = toSlugPreview(trimmed || name);

  async function handleCreate() {
    if (trimmed.length < 2) {
      setError('团队名称至少 2 个字符');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await teamApi.create(trimmed);
      await queryClient.invalidateQueries({ queryKey: ['session', 'me'] });
      navigate('/team');
    } catch {
      setError('创建失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: TOKENS.bgAlt, minHeight: '100%' }}>
      <TopBar authed />

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
          创建新团队
        </h1>
        <p
          style={{
            fontSize: 14,
            color: TOKENS.text2,
            margin: '0 0 32px',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          你将成为团队的 Owner，可以邀请成员一起管理技能库
        </p>

        <div
          style={{
            background: '#fff',
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 12,
            padding: '28px 24px',
            width: '100%',
            maxWidth: 400,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: TOKENS.text,
                marginBottom: 6,
              }}
            >
              团队名称
            </label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="例：Frontend Guild"
              maxLength={64}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              style={{
                width: '100%',
                height: 36,
                padding: '0 10px',
                fontSize: 14,
                border: `1px solid ${error ? '#EF4444' : TOKENS.border}`,
                borderRadius: 6,
                outline: 'none',
                fontFamily: 'inherit',
                background: '#fff',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {trimmed.length >= 2 && (
            <div
              style={{
                fontSize: 12,
                color: TOKENS.text3,
                background: TOKENS.bgAlt,
                padding: '6px 10px',
                borderRadius: 6,
              }}
            >
              团队标识：
              <span style={{ fontFamily: 'monospace', color: TOKENS.text2 }}>
                {slugPreview}
              </span>
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: '#EF4444', marginTop: -8 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Button
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onClick={() => navigate(-1)}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              style={{ flex: 2 }}
              onClick={handleCreate}
              disabled={loading || trimmed.length < 2}
            >
              {loading ? '创建中…' : '创建团队'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

```bash
cd frontend && npm run lint 2>&1 | tail -10
```

期望：无类型错误。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/team/CreateTeamPage.tsx
git commit -m "feat(team): add CreateTeamPage with name input and slug preview"
```

---

## Task 6: 前端路由 + NoTeamPage 更新

**Files:**
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/src/pages/team/NoTeamPage.tsx`

- [ ] **Step 1: 在 router.tsx 添加 import 和路由**

在现有 import 区域（`// Create` 注释附近）添加：

```tsx
import CreateTeamPage from '@/pages/team/CreateTeamPage';
```

在路由数组中 `// Create (any team member)` 块前（或 `// Fallback` 前）添加：

```tsx
// Team creation (any authenticated user, no team required)
{ path: '/team/create', element: <CreateTeamPage /> },
```

- [ ] **Step 2: 在 NoTeamPage.tsx 修改导航目标**

将第 134 行：

```tsx
onClick={() => navigate('/team/settings?tab=create')}
```

改为：

```tsx
onClick={() => navigate('/team/create')}
```

- [ ] **Step 3: 类型检查**

```bash
cd frontend && npm run lint 2>&1 | tail -10
```

期望：无类型错误。

- [ ] **Step 4: 构建验证**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

期望：`built in` 成功，无错误。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/router.tsx frontend/src/pages/team/NoTeamPage.tsx
git commit -m "feat(team): wire /team/create route and update NoTeamPage CTA"
```

---

## Task 7: Smoke Check（手动）

服务已在运行时执行，否则先启动：

```bash
./scripts/services.sh start
```

- [ ] **Step 1: 以无团队用户登录（或新注册用户），打开** `http://localhost:5173/team`
  - 期望：显示 `NoTeamPage`，有"创建团队"和"通过邀请码加入"两张卡片

- [ ] **Step 2: 点击"创建团队"**
  - 期望：跳转到 `http://localhost:5173/team/create`，显示名称输入框

- [ ] **Step 3: 输入名称（至少 2 字），观察 slug 预览**
  - 期望：例如输入 `My Team` → 下方显示 `my-team`

- [ ] **Step 4: 点击"创建团队"**
  - 期望：按钮变为"创建中…"，成功后跳转到 `/team`，显示团队工作台

- [ ] **Step 5: 刷新页面，确认仍在团队工作台（不再显示 NoTeamPage）**

- [ ] **Step 6: 验证 slug 冲突处理（可选）** — 再创建一个同名团队，确认后端返回 slug 带 `-1` 后缀
