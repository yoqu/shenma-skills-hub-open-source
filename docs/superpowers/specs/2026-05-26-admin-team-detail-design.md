# 超级管理员团队详情页设计

- 状态：草案
- 日期：2026-05-26
- 负责模块：`/admin/teams/*`（前端 + 后端）
- 关联现有 spec：`docs/superpowers/specs/2026-05-25-platform-super-admin-design.md`

## 背景与问题

当前超级管理员控制台 `/admin/teams` 只是一个团队列表（搜索 + 状态过滤 + 启用/禁用），"详情"按钮直接 `window.open('/teams/${slug}', '_blank')` 跳到团队公开页。这导致超管在以下场景没有可用的工具：

1. 看不到某个团队里有哪些成员、各自角色是什么、最近活动情况。
2. 看不到团队的设置（reviewMode / publicHome / description / logo / color），即便后端 `AdminTeamService.detail()` 已经返回了这些字段，前端也没消费。
3. 没法以超管身份代团队管理成员（加人、改角色、踢人），出现 Owner 离职、团队孤儿等紧急情况时只能改 DB。
4. 看不到该团队范围下的 Skill 列表，必须去 `/admin/skills` 用 teamId 过滤，体验割裂。

## 目标

- 新增 `/admin/teams/:id` 独立详情页，作为超管对某个团队进行只读检查与有限管理动作的入口。
- 把"看团队成员 / 看团队设置 / 改成员（加、改角色、踢） / 看团队 Skill"四个能力收敛到这一个页面里。
- 保持团队侧 `/api/teams/{teamId}/members` 接口的现有鉴权语义不变，超管动作走独立的 `/api/admin/teams/{id}/...` 路径，便于审计。

## 非目标

- 不做用户详情页（用户在哪些团队、什么角色），留待下一迭代。
- 不在团队详情里编辑团队 Skill / 套件本身（仅查看 + 跳详情），下架等动作仍走 `/admin/skills` 与 `/admin/suites`。
- 不允许超管在详情页里改 `reviewMode / publicHome / description / logo / color` 等业务向设置，只读展示。
- 不引入新的 OAuth、登录、邀请相关流程，添加成员走"按用户搜索 + 直接加入"，不走邀请。

## 整体方案

采用方案 C：新 controller，service 复用。

- 前端新增 `pages/admin/TeamDetail.tsx`，路由 `/admin/teams/:id`，沿用 `AdminLayout active="teams"`，内部用 `Tabs` 切换：`概览 / 成员 / Skill / 套件 / 设置`。
- 后端新增 `AdminTeamMemberController`（`/api/admin/teams/{id}/members*`）和 `PATCH /api/admin/teams/{id}` 两个入口。
- `TeamMemberService` 抽出内部方法 `internalUpdateRole(teamId, userId, role)` 和 `internalRemove(teamId, userId)`，不再调用 `requireWriter`，原 `updateRole / remove` 方法在 `requireWriter` 之后调用这两个内部方法，保持团队侧行为完全不变。
- Skill / 套件 Tab 完全复用 `useAdminSkills({ teamId })` 与 `useAdminSuites({ teamId })`，零新后端。
- 所有超管侧写操作通过 `AuditLogService.record(actorId, action, "team_member" | "team", id, payload)` 记录审计。

## 路由与导航

- 新路由：`/admin/teams/:id`（`RequireSuperAdmin` 保护，挂在 `frontend/src/router.tsx` 既有 `/admin/*` 段下）。
- 列表页改动：`pages/admin/Teams.tsx` 第 149 行的 `window.open(\`/teams/${t.slug}\`, '_blank')` 改为 `navigate(\`/admin/teams/${t.id}\`)`。再在原 actions 区追加一个 "公开页" 次级按钮保留原跳转，避免回归。
- 侧边栏 NAV 不变，详情页继续 `active="teams"`，靠 `DashTopBar` 标题区显示当前团队名。

## 详情页结构

页面顶部使用 `DashTopBar`：
- 标题：团队 name
- hint：`@{slug} · Owner @{ownerHandle} · 创建于 {createdAt}`
- 右侧 actions：`返回列表`、`访问公开页`（外链）、`禁用 / 启用`（复用 `useDisableTeam / useEnableTeam`，禁用走 `ConfirmDialog`）。

`DashTopBar` 下方是 `Tabs`，URL 通过 hash 或 query 同步当前 tab（推荐 `?tab=members`），便于 `Cmd+L` 复制分享。

### Tab：概览

只读卡片，使用 `useAdminTeamDetail(id)` 一个查询即可。展示：

| 区块 | 字段 |
|---|---|
| 基础信息 | name / slug / status / createdAt / description |
| Owner | ownerName / ownerHandle（链接到 `/u/{handle}` 公开主页） |
| 资产统计 | membersCount / skillsCount / suitesCount |
| 视觉 | logoUrl 缩略图 + color 色块 |
| 团队配置 | reviewMode（"自动通过" / "需要审核"）、publicHome（是否公开首页） |

### Tab：成员

工具栏：
- 左：搜索框（按 handle / name 前缀过滤），角色 Select（全部 / Owner / Admin / Member）
- 右：`添加成员` 按钮 → 打开 `AddMemberDialog`

表格列：头像+name / @handle / 角色 Badge / 加入时间 / 操作（`改角色` / `踢出`）

操作约束（前端禁用 + 后端兜底）：
- Owner 行：`改角色` 与 `踢出` 都禁用，title 提示 "请先在团队侧转让 Owner"。后端 `internalUpdateRole / internalRemove` 在目标是 Owner 时统一抛 `40300 T_FORBIDDEN`，与现有 `updateRole / remove` 一致。
- 不允许把任何人改为 `OWNER`，与现有 `updateRole` 校验一致。
- 踢出走 `ConfirmDialog`，文案：`将 @{handle} 从团队 {teamName} 中移除？此操作会立即生效，被移除成员的所有 PAT 不会被吊销（团队侧团队管理员仍可后续清理）`。说明这里行为故意只复用 `remove` 的核心逻辑，不复制 `leave` 的 PAT revoke，与现有 `remove` 的行为对齐。

`AddMemberDialog`：
- Input：按 handle / name / email 搜索，下拉用 `useAdminUsers({ q, size: 8 })` 防抖请求，命中后展示头像 + name + handle + email。
- Select：角色 `Member`（默认）/ `Admin`，不允许选 `OWNER`。
- 提交后调用 `POST /api/admin/teams/{id}/members`，body `{ userId, role }`。
- 错误：已是成员返回 `40901 T_MEMBER_EXISTS`，前端用 `toast` 提示。

### Tab：Skill

完全用 `useAdminSkills({ teamId: id })` 直出列表，复用 `pages/admin/Skills.tsx` 的渲染组件抽出公共表格 `AdminSkillsTable`。每行点击跳 `/teams/{slug}/skills/{skillSlug}`，不在这里做下架等写操作，避免与 `/admin/skills` 重复。

### Tab：套件

同 Skill，复用 `useAdminSuites({ teamId: id })`。

### Tab：设置

只读两栏布局：左侧"平台可改"小卡片，右侧"团队自治"只读区。

平台可改区（一个 inline 表单）：
- name（必填，trim 后长度 1-60）
- slug（必填，仅允许 `[a-z0-9-]{2,40}`，前端 regex 校验）
- status（Select：ACTIVE / DISABLED）

表单提交走 `PATCH /api/admin/teams/{id}`，body 只携带变更字段。状态字段从 PATCH 单独走是为了兼容已有 `disable/enable` 端点：PATCH 内部转调 `disable/enable` 服务方法以走相同 audit 路径。

团队自治只读区（一行一行展示）：
- reviewMode / publicHome / description / logoUrl / color
- 顶部提示："这些字段由团队 Owner / Admin 在 /team/admin/settings 自行维护，超级管理员仅查看。"

## 后端变更

### 新 controller：`AdminTeamMemberController`

路径 `/api/admin/teams/{teamId}/members`，挂 `@RequireSuperAdmin`。

| 方法 | 路径 | 行为 |
|---|---|---|
| GET | `/` | 分页列出成员；query `q`、`role`、`page`、`size`。底层调用 `teamMemberService.page(teamId, role, q, pq, /*currentUserId*/ actorId)`，但因为是超管，过 `publicHome` 校验时无差别放行（service 内已通过 `permissionService.isSuperAdmin(currentUserId)` 判定）。 |
| POST | `/` | body `{ userId, role }`，调用 `teamMemberService.addMember(teamId, userId, role)`，再写审计 `team_member.add`。校验 role ∈ {ADMIN, MEMBER}。 |
| PUT | `/{userId}` | body `{ role }`，调用新内部方法 `teamMemberService.internalUpdateRole(teamId, userId, role)`，写审计 `team_member.role_change`。 |
| DELETE | `/{userId}` | 调用新内部方法 `teamMemberService.internalRemove(teamId, userId)`，写审计 `team_member.remove`。 |

### `TeamMemberService` 重构

把现有 `updateRole(teamId, userId, operatorId, req)` 中 `requireWriter` 之后的核心逻辑抽到 `internalUpdateRole(teamId, userId, role)`，原方法保留 `requireWriter` + role 标准化后调用内部方法。

`remove(teamId, userId, operatorId)` 同样抽出 `internalRemove(teamId, userId)`，原方法保留 `requireWriter` 调用内部方法。

`addMember` 已经不依赖调用方角色，直接复用，不需要重构。

约束：内部方法继续保留 Owner 保护（不能改 Owner 角色、不能移除 Owner、不能升为 Owner）。这些保护对团队 Admin 和超管同样适用，因为超管走详情页"踢 Owner"会破坏团队所有权语义，应改为"先用团队侧转让所有权"。

### `AdminTeamController` 新增 PATCH

```
PATCH /api/admin/teams/{id}
Body: { "name"?: string, "slug"?: string, "status"?: "ACTIVE" | "DISABLED" }
```

- name / slug 走 `AdminTeamService.updateBasic(id, name, slug)`：trim、长度与正则校验、slug 唯一性检查（已被其他团队占用返回 `40901`）。
- status 内部转调既有 `disable(id) / enable(id)`，保持 audit 一致。
- 三个字段同时只能各自变化时记录一条 audit；多字段同次 PATCH 时拆成多条 audit 记录。

### 鉴权与 audit

- 所有 admin 端点继续走 `@RequireSuperAdmin` aspect。
- `requireActor(me)` 复用 `AdminTeamController` 现有同名私有方法的实现，未登录抛 `40100`。
- 所有写动作必须在 service 操作成功后写 `AuditLogService.record(actor, action, target, targetId, payload)`，payload 至少包含 teamId / targetUserId / 变更前后值。

### DTO 列表

新增：

- `AdminUpdateTeamReq`：name / slug / status，字段全部可选 + JSR-303 注解（`@Size`、`@Pattern`）。
- `AdminTeamAddMemberReq`：`userId`（必填）、`role`（必填，`@Pattern("ADMIN|MEMBER")`）。
- `AdminTeamUpdateMemberRoleReq`：`role`（同上）。

复用：`TeamMemberRes`（团队侧已有）作为列表返回，避免再造一个 DTO。

## 前端变更

### API client

`frontend/src/api/endpoints.ts` 在 `adminApi` 下追加：

```ts
updateTeam: (id: number, body: AdminUpdateTeamReq) =>
  http.patch<unknown, void>(`/admin/teams/${id}`, body),
listTeamMembers: (id: number, q: { q?: string; role?: string; page?: number; size?: number }) =>
  http.get<unknown, PageRes<TeamMember>>(`/admin/teams/${id}/members`, { params: q }),
addTeamMember: (id: number, body: { userId: number; role: 'ADMIN' | 'MEMBER' }) =>
  http.post<unknown, void>(`/admin/teams/${id}/members`, body),
updateTeamMemberRole: (id: number, userId: number, role: 'ADMIN' | 'MEMBER') =>
  http.put<unknown, void>(`/admin/teams/${id}/members/${userId}`, { role }),
removeTeamMember: (id: number, userId: number) =>
  http.delete<unknown, void>(`/admin/teams/${id}/members/${userId}`),
```

`frontend/src/api/admin.ts` 追加对应 hooks：`useUpdateAdminTeam`、`useAdminTeamMembers`、`useAddAdminTeamMember`、`useUpdateAdminTeamMemberRole`、`useRemoveAdminTeamMember`。mutation 成功后失效 `['admin', 'team-members', id]` 与 `['admin', 'team', id]`，必要时也失效 `['admin', 'teams']`（成员数变化）。

### 页面与组件

新增：

- `pages/admin/TeamDetail.tsx`：路由组件，读取 `:id`，渲染 `AdminLayout` + `DashTopBar` + `Tabs` + 当前 tab 子组件。`?tab=` 用 `useSearchParams` 同步。
- `pages/admin/teamDetail/OverviewTab.tsx`
- `pages/admin/teamDetail/MembersTab.tsx`（含 `MembersTable` 与 `AddMemberDialog`）
- `pages/admin/teamDetail/SkillsTab.tsx`
- `pages/admin/teamDetail/SuitesTab.tsx`
- `pages/admin/teamDetail/SettingsTab.tsx`

设计 token、UI 组件全部复用 `frontend/src/lib/tokens.ts` 与 `frontend/src/components/ui` 既有原子组件。表格沿用 `Teams.tsx / Users.tsx` 已有的 `tableStyle / thStyle / tdStyle` 风格，必要时把样式抽到 `pages/admin/_shared/table.ts`。

修改：

- `pages/admin/Teams.tsx`：`详情` 按钮 → `navigate`。
- `frontend/src/router.tsx`：注册新路由。

### 状态、loading、错误

- 详情接口失败（404 不存在）：整页 `EmptyState` 提示 "团队不存在或已删除"，并提供 "返回团队列表" 按钮。
- 成员添加冲突（已是成员）：`toast({ kind: 'warning', message: ... })`，不算错误。
- 删除/改角色 Owner 时前端禁用按钮 + title 提示，后端兜底 400 / 403。

## 数据库与 migration

无 schema 变更。所有读写沿用现有表（`teams`, `team_members`, `users`, `admin_audit_log`）。

## 验证计划

- 后端：新增 `AdminTeamMemberServiceTest`（或在现有 admin 测试包内）覆盖：加人成功、加人重复、改角色到 ADMIN/MEMBER 成功、改角色到 OWNER 被拒、移除 Owner 被拒、PATCH 改 name / slug 成功、slug 撞库 409。每个 case 都断言生成的 `admin_audit_log` 行。
- 后端：`mvn -q -DskipTests compile` 通过；新增/受影响的测试 `mvn test` 通过。
- 前端：`npm run lint`（即 `tsc -b --noEmit`）通过；`npm run build` 通过。
- 浏览器 smoke：以超管登录 → 进入 `/admin/teams` → 点详情进入新页面 → 切五个 Tab → 添加一个成员 → 改角色 → 踢出（非 Owner）→ 改 name/slug → 改 status → 公开页 / 列表页回归正常。

## 风险与缓解

- **业务规则漂移**：超管路径与团队管理员路径走的是同一份内部方法（`internalUpdateRole / internalRemove`），唯一差异是不调 `requireWriter`。需要在重构后跑完团队侧 member 相关测试，确认行为不退化。
- **slug 唯一性碰撞**：PATCH 同时改 slug 与 status 时，slug 唯一性校验失败要在事务前置，不能让 status 已变更而 slug 写入失败导致状态半成品。`updateBasic` 内先校验、再写库。
- **审计噪声**：超管的浏览动作（GET）不写 audit，仅写动作（POST/PUT/DELETE/PATCH）。

## 后续可能扩展（不在本期实现）

- 用户详情页 `/admin/users/:id`，反向展示用户的团队 / 角色 / 最近活动。
- 团队详情页加 `审计日志` Tab，按 targetType=team / team_member + targetId 过滤显示。
- 详情页设置区开放更多字段（reviewMode 等）的写权限。
