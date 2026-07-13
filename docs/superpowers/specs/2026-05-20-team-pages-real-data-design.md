# Team 页面真实数据对接设计

**日期**: 2026-05-20  
**范围**: `frontend/src/api/data.ts` + team 子页面

---

## 背景

Team 页面（admin + member 两套工作台）存在多处硬编码假数据，未真正从后端获取。本次修复以优先级顺序处理以下 5 类问题。

---

## 问题清单

| # | 问题 | 优先级 | 涉及文件 |
|---|------|--------|---------|
| 1 | `CURRENT_TEAM_ID = 1` / `CURRENT_TEAM_SLUG = 'ludou-fe'` 写死 | 高 | `api/data.ts`, `admin/_shared/api.ts` |
| 2 | 当前用户 handle 写死 (`zhao_yc`) | 高 | `admin/Members/MembersTable.tsx` |
| 3 | 已安装 Skill 列表写死 | 中 | `member/Dashboard.tsx`, `member/Skills.tsx`, `member/Suites.tsx` |
| 4 | 回复框用户头像写死 (`陈奕笑`) | 中 | `member/MySubmissions/CommentsModal.tsx` |
| 5 | 废弃 mock 数据数组残留 | 低 | `member/MySubmissions/data.ts` |

---

## 方案选择

采用**方案 B：Hook 派生团队上下文**。

理由：`useSession()` 已经调用 `/me`，响应体包含 `myTeams` 数组。新增一个 `useCurrentTeam()` hook 直接从 React Query 缓存中提取第一个团队的 id/slug，无需新的 Context、Provider 或额外网络请求。与现有所有 hook 的模式（依赖 `useSession` 的 `isSuccess` 做 `enabled` 门控）完全一致。

---

## 详细设计

### 1. 动态化团队上下文

**新增 hook `useCurrentTeam()`（`api/data.ts`）**

```ts
export function useCurrentTeam() {
  const { data: teams = [], isSuccess } = useMyTeams();
  const first = teams[0];
  return {
    teamId: first ? parseInt(first.id) : undefined,
    teamSlug: first?.slug,
    isReady: isSuccess && !!first,
  };
}
```

**修改 7 个现有 hook**

每个 hook 将 `CURRENT_TEAM_ID`/`CURRENT_TEAM_SLUG` 替换为 `useCurrentTeam()` 的返回值，`enabled` 条件改为 `isReady && teamId !== undefined`（或 `isReady && !!teamSlug`）：

- `useTeam(slug?)` — `slug ?? teamSlug`，不再接受带默认值的常量参数
- `useTeamSkills(params)` — 使用 `teamId`
- `useTeamMembers(params)` — 使用 `teamId`
- `useReviews(status?)` — 使用 `teamId`
- `useSuites(params)` — 使用 `teamId`
- `useInvites()` — 使用 `teamId`
- `useActivity(limit)` — 使用 `teamId`

**删除常量**

- `api/data.ts`: 删除 `CURRENT_TEAM_ID = 1` 和 `CURRENT_TEAM_SLUG = 'ludou-fe'`（第 21-22 行）
- `admin/_shared/api.ts`: 删除 `CURRENT_TEAM_ID = 1` 和 `CURRENT_TEAM_SLUG = 'ludou-fe'`（第 25-26 行，孤立常量，无页面直接 import）

**Query key 变更**

原 `['team-skills', 1, params]` → `['team-skills', teamId, params]`。因 `teamId` 来自同一 session 缓存，实际值不变，不会引起多余的网络请求。

---

### 2. 当前用户识别动态化

**`admin/Members/MembersTable.tsx`**

- `MembersTableProps` 新增可选字段 `meHandle?: string`
- 第 49 行 `const isMe = m.handle === 'zhao_yc'` 改为：
  ```ts
  const isMe = !!meHandle && m.handle === meHandle;
  ```

**`admin/Members.tsx`**

- 已调用 `useMyTeams()`，补充解构 `me`：
  ```ts
  const { me } = useMyTeams();
  ```
- 向 `<MembersTable>` 传入 `meHandle={me?.handle}`

---

### 3. 移除硬编码安装状态

后端目前无 `GET /me/skills`（已安装列表）接口，暂时移除相关 UI。

**`member/Skills.tsx`**

- 删除 `INSTALLED_SLUGS` 常量
- tabs 数组中移除 `{ id: 'installed', ... }` 和 `{ id: 'fav', ... }` 两项
- `list` 过滤逻辑中移除 `installed`/`fav` case
- `MemberSkillCard` 中移除 "已安装" badge，统一显示安装按钮

**`member/Suites.tsx`**

- 删除 `INSTALLED_SLUGS` 常量
- `SuiteViewer` 中删除 `installedCount` 变量及 "X/Y 已安装" 计数行（该行在表头右侧，仅此一处）

**`member/Dashboard.tsx`**

- 删除 `INSTALLED_SLUGS` 常量
- "我安装的 Skill" stat 的 `value` 改为 `'—'`，delta 改为 `'暂不支持'`

---

### 4. CommentsModal 用户头像动态化

**`member/MySubmissions/CommentsModal.tsx`**

- `CommentsModalProps` 新增 `me?: { name: string; avatar: string; handle: string }`
- 第 210-213 行替换：
  ```tsx
  <Avatar
    name={me?.name ?? ''}
    char={me?.avatar ?? '?'}
    size={28}
    color={hashColor(me?.handle ?? '')}
  />
  ```

**`member/MySubmissions/index.tsx`**

- 调用 `const { me } = useMyTeams()`
- 向 `<CommentsModal>` 传入 `me={me}`

---

### 5. 清理废弃 mock 数据数组

**`member/MySubmissions/data.ts`**

- 删除 `MY_SUBMISSIONS` 数组（已废弃，`index.tsx` 使用 `useReviews()` 获取真实数据）
- 保留文件中的类型定义（`Submission`、`SubmissionComment`、`StatusMeta` 等仍被 `CommentsModal` 引用）

---

## 不在本次范围内

- 占位符手机号（`PhoneInvites.tsx` 初始值）— 纯 UI 细节，不影响数据正确性
- Logo URL 默认值、域名前缀 — 配置类，不属于假数据问题
- 状态/角色映射常量（STATUS_MAP、ROLE_TONE 等）— 合理的前端枚举，无需修改

---

## 验证标准

1. 切换用户登录后，工作台展示的团队名称、成员数、Skill 数与后端一致
2. Members 表格中 "你" 徽标准确标记当前登录用户
3. Skills 页面无 "我已安装" tab，安装按钮可正常调用后端接口
4. CommentsModal 回复框头像显示当前登录用户姓名首字
5. TypeScript 编译无错误（`npm run lint`）
