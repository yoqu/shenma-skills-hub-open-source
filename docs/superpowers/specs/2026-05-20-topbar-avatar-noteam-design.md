# TopBar 头像跳转 & 无团队引导页设计

**日期**: 2026-05-20  
**范围**: 前端 — TopBar 组件 + 无团队引导页新组件

---

## 功能一：头像点击跳转个人资料页

### 现状

`TopBar.tsx` 中头像按钮逻辑：

```tsx
onClick={() => me?.handle && navigate(`/u/${me.handle}`)}
```

问题：`me?.handle` 为空时（用户未设置 handle），点击无任何响应，用户体验断层。

### 修复方案

改为有 fallback 的导航：

```tsx
onClick={() => navigate(me?.handle ? `/u/${me.handle}` : '/team/prefs')}
```

- handle 存在 → 跳转 `/u/{handle}`（公开个人资料页，已有路由）
- handle 不存在 → 跳转 `/team/prefs`（个人偏好设置页，已有路由）

**改动范围**：`TopBar.tsx` 第 351 行，一行修改。

---

## 功能二：无团队引导整页

### 触发条件

用户已登录（有有效 JWT），但尚未创建或加入任何团队，此时 `useMyTeams()` 返回 `teams = []`。

### 架构

在 `RoleAware.tsx` 的 `TeamDashboardRoute` 中加入前置检查：

```tsx
export function TeamDashboardRoute() {
  const { data: teams, isSuccess } = useMyTeams();
  if (!isSuccess) return null;           // 加载中，不渲染
  if (teams.length === 0) return <NoTeamPage />;  // 无团队，引导页
  return useRole() === 'Admin' ? <AdminDashboard /> : <MemberDashboard />;
}
```

`isSuccess` 保证数据加载完成后再判断，避免闪屏（先显示引导页又切换到 Dashboard）。

### 新组件：`NoTeamPage`

**文件位置**：`frontend/src/pages/team/NoTeamPage.tsx`

**页面布局**：

```
┌─────────────────────────────────────────────┐
│  TopBar (authed={!!getToken()})             │
├─────────────────────────────────────────────┤
│                                             │
│           [图标]                            │
│     你还没有加入任何团队                    │
│  创建一个新团队，或使用邀请码加入已有团队   │
│                                             │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │  创建新团队  │  │  通过邀请码加入      │ │
│  │              │  │  [输入框] [确认]     │ │
│  │  → 跳转创建  │  │                      │ │
│  └──────────────┘  └──────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

**两个操作入口**：

1. **创建新团队**
   - 点击按钮 → `navigate('/team/settings?tab=create')`
   - 该路由已存在，无需新增

2. **通过邀请码加入**
   - 行内 `<input>` 输入邀请码 + 「加入」按钮
   - 点击「加入」→ 调用 `teamApi.joinByCode(code)`（已有 API：`POST /teams/join-by-code`）
   - 成功后调用 React Query 的 `queryClient.invalidateQueries(['my-teams'])` 刷新团队列表，自动离开引导页
   - 失败 → 行内显示错误提示（邀请码无效 / 已过期）

**状态管理**：
- `code: string` — 输入框受控值
- `loading: boolean` — 提交中禁用按钮
- `error: string | null` — 错误信息行内展示

**样式**：沿用项目现有 `TOKENS` + `Button` + `Card` 原子组件，与整体设计语言一致。

---

## 不在本次范围内

- 创建团队的具体表单（已有 `/team/settings?tab=create`，不重复建设）
- 其他 `/team/*` 子路由（如 `/team/skills`、`/team/members`）的无团队守卫（本次仅处理 `/team` 入口）
- 后端 API 变更

---

## 涉及文件

| 文件 | 操作 |
|------|------|
| `frontend/src/components/chrome/TopBar.tsx` | 修改头像 onClick（1 行）|
| `frontend/src/pages/team/RoleAware.tsx` | 在 `TeamDashboardRoute` 加无团队判断 |
| `frontend/src/pages/team/NoTeamPage.tsx` | 新建无团队引导页组件 |
