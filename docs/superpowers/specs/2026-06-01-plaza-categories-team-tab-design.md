# Plaza 分类筛选 + 团队 Skill Tab 设计

- 日期：2026-06-01
- 范围：前端为主（`frontend/src/pages/public/Plaza.tsx` + `frontend/src/api/endpoints.ts`），无后端改动、无 migration。

## 背景与目标

当前资产广场 `frontend/src/pages/public/Plaza.tsx` 一次性加载 48 条公开 skill/prompt，只提供客户端文本搜索，没有分类维度，也不区分公共资产与当前团队资产。

目标：

1. 给广场增加**分类（category）筛选**，让用户按领域快速收敛 skill。
2. 登录且有团队的用户，额外提供**当前团队 skill** 视图，便于查询和选择团队内可复用资产。
3. 整体保持轻量，符合 AGENT.md「公共广场保持轻量」与「团队功能是核心」的边界。

## 现状盘点（已确认可复用）

- 公共 skill：`usePublicSkills({...})` → `GET /api/skills`（公开白名单，`PlazaQuery` 已支持 `cat`/`q`/`sort` 等服务端参数）。
- 团队 skill：`useTeamSkills({...})` → `GET /api/teams/{teamId}/skills`，支持 `cat`/`status`/`visibility` 等；由 `useCurrentTeam()` 的 `isReady` 自动 gate。
- 分类：`useCategories()` → `GET /api/categories`（公开），返回真实 `{ id, name, count }`。
- 当前团队：`useCurrentTeam()` 提供 `teamId`/`teamSlug`/`role`/`isReady`/`hasNoTeams`。
- 登录态：`getToken()`（`skillstack.jwt`）。
- 可复用 UI：`chrome/Tabs`（底边线 Tab + count 徽章）、`ui/SegmentedControl`（现用于 Skills/Prompts）。
- **关键约束**：公共 prompt API `promptApi.plaza` 只接受 `page/size/q`，**不支持 `cat`**；团队 prompt API 支持 `cat`。Prompt 卡片对象带 `cat` 字段。

## 布局结构

```
资产广场
[公共广场] [当前团队·<name>]      ← 一级 Tab（chrome/Tabs；登录且有团队才渲染）
  (Skills) (Prompts)             ← SegmentedControl（保留现状）
  🔍 搜索...                      ← 保留现状（客户端搜索）
  [全部][开发工具][数据]...        ← 分类 chip 单选行（新增）
  ─────────────────────────
  □ card  □ card  □ card          ← 3 列网格（保留现状）
```

- 未登录 / 无团队（`!getToken()` 或 `hasNoTeams`）：不渲染一级 Tab，页面等价于当前公共广场，行为不回退。

## 数据流（核心决策）

> 实现说明（2026-06-01）：原计划「Skills 走服务端 `cat`」在动工时被推翻，改为**统一客户端过滤**。原因见下方「实现中发现的约束」。

- **分类列表来源**：`useCategories()`（`/api/categories`，真实分类名）。响应本身已含 `id='all'` 的「全部」项，组件仅在缺失时才补，避免重复。`全部` 为默认选中（`cat='all'`）。
- **分类过滤统一走客户端**：选中分类后，对当前 source + 资产类型「已加载集合」按 `item.cat` 客户端过滤，Skills 与 Prompts 行为一致。
- **搜索保持客户端**：沿用现状 `matchesSearch` / `matchesPrompt`，不引入服务端搜索与 debounce。分类筛选与搜索叠加（先分类、后搜索）。

### 实现中发现的约束（导致改方案）

1. 公共 `GET /api/skills` 由 Controller 绑定 `PageQuery` 并调用 `SkillService.listPublicSkills`，该方法用**硬编码 `visibility=PUBLIC AND status=APPROVED`** 的 `selectPublicSkills`，**完全忽略 `cat`**。带 `cat` 的 `listPlaza`/`selectPlaza` 存在但未接到该端点。
2. `selectPlaza` 在 `visibility`/`status` 为空时**不强制公开**，若贸然把公共端点改走 `listPlaza`，会**泄露非公开 skill**（安全回归）。
3. 公共 prompt API 同样不支持 `cat`。
4. 实际公开 skill 仅 9 条（plaza 一次加载 48），客户端过滤覆盖完整、零泄露风险，契合 AGENT.md「公共广场保持轻量」。

故撤销 `skillApi.plaza` 的 `cat` 类型扩展（避免广告一个端点会忽略的参数），改统一客户端过滤。数据规模增大需服务端分类时，应另立项给公共端点加**保持 PUBLIC+APPROVED 前提**的 cat 过滤。

## 计数徽章的诚实处理

- `/api/categories` 返回的 `count`（如 `开发工具 86`）是 **seed/占位计数**，与真实公开 skill 数（9）对不上，直接展示会误导。
- 因此 chip 计数**从当前 source + 资产类型的已加载集合实时统计**（`全部` = 集合总数，其它 = 该分类条目数），点击后展示结果与 chip 数字始终一致。
- 切换 source / 资产类型时计数随之重算（已验证：公共 `全部9`，切团队后 `全部8`）。

## 状态与边界

- Plaza 内 `useState`：
  - `source: 'public' | 'team'`（默认 `'public'`）
  - `assetTab: 'skills' | 'prompts'`（保留现状，默认 `'skills'`）
  - `cat: string`（默认 `'all'`）
  - `q: string`（保留现状）
- 切换 `source` 或 `assetTab` 时，`cat` 重置为 `'all'`，避免跨视图带着不存在/空结果的分类。
- 数据请求：
  - `usePublicSkills` / `usePublicPrompts`：始终启用（沿用现状）。
  - `useTeamSkills` / `useTeamPrompts`：由 `isReady` 自动 gate；仅在 `source==='team'` 时用于渲染。
  - 当前网格根据 `source` + `assetTab` 选择对应数据集，再叠加分类（Skills 已服务端过滤 / Prompts 客户端过滤）与搜索。
- 边界状态：
  - loading：沿用现状（数据未到时为空数组）。
  - 空结果：复用现有 empty `Card`，文案按 `source` 区分（公共 vs 当前团队）。
  - 团队 Tab 仅展示 `/teams/{teamId}/skills` 默认返回的 skill，不额外加 `status` 过滤，沿用后端默认行为。

## 改动清单（实际）

- `frontend/src/pages/public/Plaza.tsx`（唯一改动文件）：
  - 新增 `source` 一级 Tab（复用 `chrome/Tabs`），登录且有当前团队时渲染，标签含团队名。
  - 新增 `CategoryChips`（本文件内局部组件，行内 style，遵循 Tailwind Preflight 铁律），单选；计数从已加载集合实时统计。
  - 接入 `useCategories` / `useMyTeams` / `useTeamSkills` / `useTeamPrompts` / `useCurrentTeam(authed)`。
  - 状态 `source`/`assetTab`/`cat`/`q`；切换 source 或资产类型时 `cat` 重置为 `'all'`；空态文案按 source 区分。
- `frontend/src/api/endpoints.ts`：**无最终改动**（中途加的 `cat`/`sort` 类型已撤销，见上）。

## 未来项（数据规模增大时）

客户端过滤受限于一次加载 48 条；当公开 skill 远超此规模时，需给公共端点加**保持 `PUBLIC+APPROVED` 前提**的服务端 `cat` 过滤（新增 cat-aware 且强制公开的查询，或在 `listPublicSkills` 上加 cat 参数），并把分类计数改为后端按可见集合统计。属带安全约束的后端改动，另立项评估。

## 验证

- `cd frontend && npm run lint`（tsc 类型检查）
- `cd frontend && npm run build`
- 浏览器 smoke：
  - 未登录访问 `/plaza`：无一级 Tab，分类 chip 可切换并过滤 Skills，计数显示。
  - 登录有团队：出现「公共广场 / 当前团队」一级 Tab，团队 Tab 显示团队 skill 并可按分类过滤。
  - Skills/Prompts 切换、分类切换不报错，空态文案正确。
