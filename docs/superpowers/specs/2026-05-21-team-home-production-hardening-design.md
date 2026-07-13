# 团队主页生产化改造需求 Spec

**日期**: 2026-05-21  
**状态**: Draft / 待确认  
**范围**: 团队主页与团队工作台现有功能生产化改造  
**不做**: 不新增细化新的 feature 功能，不扩展安装统计、Token 管理、通知系统、团队创建等新能力

---

## 1. 背景

团队主页当前已经接入了部分后端真实接口，但仍存在三类生产风险：

1. 左侧菜单看起来可点击，但不会导航。
2. 工作台混用真实接口、硬编码文案、伪趋势和本地兜底数据，用户容易误判数据真实性。
3. 当前团队、当前角色、审核权限仍有明显原型痕迹，不能作为生产环境的权限与数据边界。

本次改造目标不是增加更多团队功能，而是把已经存在的团队主页、Admin 工作台、Member 工作台、团队左侧菜单和相关数据链路调整到生产可用标准。

---

## 2. 改造目标

### 2.1 用户目标

- 团队左侧菜单点击后必须能进入对应团队页面。
- 工作台上展示的数字、列表、状态和文案必须能追溯到真实接口或明确为空态。
- Admin 与 Member 看到的页面必须由当前用户在当前团队中的真实角色决定。
- 当前团队切换后，团队工作台中的数据必须跟随当前团队变化。

### 2.2 工程目标

- 移除团队主页中的伪数据、伪趋势、伪增量和错误兜底。
- 所有可点击控件必须有明确行为：真实跳转、真实提交、禁用态，三选一。
- 关键权限必须由后端校验，前端只负责入口展示与用户体验。
- 保持已有页面结构和功能边界，不引入新的业务模块。

---

## 3. 明确不在范围内

以下内容即使当前页面已有入口或占位，也不在本次改造中扩展为新功能：

- 新增团队创建完整流程。
- 新增“我安装的 Skill”统计接口。
- 新增安装趋势、周活跃、月增长等分析接口。
- 新增通知偏好持久化。
- 新增个人 Token 创建、复制、吊销接口。
- 新增团队成员个人资料自定义能力。
- 新增审核评论、重新提交、撤回等完整协作流程。
这些入口若没有真实实现，应改为隐藏、禁用或跳转到已有页面，而不是继续展示为可用功能。

---

## 4. 现状问题清单

### P0. 左侧菜单点击无效

**现象**: 团队界面左侧菜单有 pointer 光标，点击后页面不变。

**根因**:

- `TeamSidebar` 只调用 `onNavigate?.(it.id)`。
- `AdminShell` 和 `MemberShell` 使用 `TeamSidebar` 时没有传入 `onNavigate`。

**涉及文件**:

- `frontend/src/components/chrome/TeamSidebar.tsx`
- `frontend/src/pages/team/admin/_shared/AdminShell.tsx`
- `frontend/src/pages/team/member/_shared/MemberShell.tsx`
- `frontend/src/router.tsx`

**生产要求**:

- 左侧菜单必须通过统一 `SidebarKey -> route` 映射导航。
- Admin 菜单项应导航到现有 Admin 页面：
  - `overview` -> `/team`
  - `skills` -> `/team/skills`
  - `reviews` -> `/team/reviews`
  - `members` -> `/team/members`
  - `invites` -> `/team/invites`
  - `suites` -> `/team/suites`
  - `settings` -> `/team/settings`
- Member 菜单项应导航到现有 Member 页面：
  - `overview` -> `/team`
  - `skills` -> `/team/skills`
  - `mine` -> `/team/mine`
  - `members` -> `/team/members`
  - `suites` -> `/team/suites`
  - `prefs` -> `/team/prefs`
- 导航时必须保留必要的当前团队上下文。
- 不允许保留“可点击但无行为”的菜单项。

---

### P0. 当前团队上下文不可靠

**现象**: 团队工作台默认读取 `myTeams[0]`，顶部切换团队后跳到公开团队页，并不会切换工作台数据上下文。

**涉及文件**:

- `frontend/src/api/data.ts`
- `frontend/src/hooks/useCurrentTeam.ts`
- `frontend/src/components/chrome/TopBar.tsx`
- `frontend/src/pages/team/RoleAware.tsx`

**生产要求**:

- 团队工作台必须有唯一可信的当前团队上下文来源。
- 当前团队上下文必须至少包含：
  - `teamId`
  - `teamSlug`
  - 当前用户在该团队中的 `role`
- 所有团队工作台数据 hook 必须使用同一个当前团队上下文。
- 顶部团队切换必须改变工作台上下文，而不是只跳转公开页。
- 当前团队不存在或用户无权访问时，必须进入清晰空态或错误态。

**约束**:

- 本次不新增团队创建流程。
- 如当前仓库暂不支持 URL 化团队工作台，可先采用持久化当前团队选择，但必须让所有 team hooks 读取同一来源。

---

### P0. 角色与权限由前端伪造

**现象**: `useRole()` 通过 URL `?as=member` 决定 Admin/Member 页面，默认 Admin。

**涉及文件**:

- `frontend/src/lib/role.ts`
- `frontend/src/pages/team/RoleAware.tsx`
- `backend/src/main/java/com/skillstack/review/controller/ReviewController.java`
- `backend/src/main/java/com/skillstack/skill/controller/SkillController.java`
- `backend/src/main/java/com/skillstack/suite/controller/SuiteController.java`

**生产要求**:

- 前端角色判断必须来自当前团队 membership，而不是 URL query。
- Admin-only 页面入口可以由前端隐藏，但后端必须做最终权限校验。
- 审核队列、审核详情、审核决策必须校验：
  - 当前用户是该团队成员。
  - 审核决策仅允许 `OWNER` / `ADMIN`。
- 团队 Skill 列表必须校验当前用户对团队私有内容的访问权限。
- 团队套件写操作必须校验当前用户写权限。

**不做**:

- 不新增复杂权限模型。
- 不新增细粒度 RBAC。
- 只落实当前已有 `OWNER` / `ADMIN` / `MEMBER` / `VIEWER` 的边界。

---

### P1. Admin 工作台存在伪指标

**现象**: Admin 工作台部分数据来自真实接口，但仍包含伪造指标。

**涉及文件**:

- `frontend/src/pages/team/admin/Dashboard.tsx`

**伪数据项**:

- `CHART_DATA`: 伪随机 30 天安装趋势。
- `WEEKLY_DELTAS`: 伪“本周新增”。
- “公开 Skill / 私有 Skill”的 “↑ 2 本月 / ↑ 1 本月”。
- “平均处理时长 4.2 小时”。
- “活跃成员 = members - 2”。
- “安装趋势 · 麓豆前端组所有公开 Skill”硬编码团队名。

**生产要求**:

- 没有真实接口支撑的指标必须移除或显示明确不可用空态。
- 允许保留以下真实数据：
  - 团队公开 Skill 数。
  - 团队私有 Skill 数。
  - 待审核数量。
  - 团队成员数量。
  - 团队动态列表。
  - 团队 Skill 列表。
- “本周活跃 Skill”如无真实活跃度接口，不得宣称按安装、引用、构建调用次数排序。
- 安装趋势如无真实趋势接口，应隐藏该区块，而不是展示伪图表。

---

### P1. Member 工作台存在错误兜底和伪状态

**现象**: 当前用户没有提交记录时，Member 工作台会 fallback 到全队审核记录，导致“我的提交”显示别人的提交。

**涉及文件**:

- `frontend/src/pages/team/member/Dashboard.tsx`
- `frontend/src/pages/team/member/MySubmissions/index.tsx`

**生产要求**:

- “我的提交”只能展示 `submittedBy.handle === currentUser.handle` 的记录。
- 没有本人提交时必须展示空态。
- 不允许 fallback 到全队审核记录。
- “我安装的 Skill”如无真实接口，必须隐藏或显示明确不可用，不能伪造数量。
- “团队本周热门”如只基于 `installs` 排序，应改名为与真实字段一致的名称，例如“团队安装量较高的 Skill”；不能声称“本周”。
- “推荐套件”如无推荐字段，只能展示“团队套件”或“最近更新套件”。

---

### P1. 可点击控件无行为

**现象**: 工作台、成员页、Skill 页、套件页、偏好页中存在大量按钮有视觉反馈但没有行为。

**涉及页面**:

- `frontend/src/pages/team/admin/Dashboard.tsx`
- `frontend/src/pages/team/member/Dashboard.tsx`
- `frontend/src/pages/team/admin/Members.tsx`
- `frontend/src/pages/team/admin/Skills.tsx`
- `frontend/src/pages/team/admin/Suites.tsx`
- `frontend/src/pages/team/member/Prefs.tsx`
- `frontend/src/pages/team/member/MySubmissions/index.tsx`

**生产要求**:

所有按钮必须归类处理：

1. **真实跳转**: 已有页面承接的按钮，必须跳转到已有 route。
2. **真实操作**: 已有接口承接的按钮，必须调用接口并处理 loading / error / success。
3. **禁用/隐藏**: 没有现有页面或接口承接的按钮，必须禁用或隐藏。

本次不允许为了让按钮可用而新增业务 feature。比如：

- “提交 Skill”可以跳转现有 `/create/skill`。
- “创建套件”可以跳转现有 `/create/suite` 或现有套件页面的创建入口。
- “邀请成员”可以跳转现有 `/team/invites`。
- “审核设置”可以跳转现有 `/team/settings`。
- “我安装的 Skill”“新建 Token”“保存偏好”“离开团队”等如果没有后端能力，应禁用或隐藏。

---

### P1. 团队偏好页仍是静态原型

**现象**: `Prefs` 页面中的通知偏好、个人资料、Token、离开团队均为本地状态或硬编码数据。

**涉及文件**:

- `frontend/src/pages/team/member/Prefs.tsx`

**生产要求**:

- 没有真实后端能力的 tab 必须标记为不可操作或隐藏。
- 不得展示伪 Token。
- 不得展示硬编码用户 `陈奕笑`、硬编码邮箱、硬编码团队名。
- 若保留页面作为静态信息页，必须确保所有可操作按钮禁用。

---

### P2. 数据加载、错误和空态不足

**现象**: 多数团队页面默认 `data = []`，加载中、接口错误、无权限、无数据状态区分不清。

**涉及文件**:

- `frontend/src/api/data.ts`
- `frontend/src/pages/team/**`

**生产要求**:

- 页面至少区分：
  - loading
  - empty
  - forbidden
  - error
  - success
- 权限错误不得表现为空列表。
- 接口失败不得静默降级为 0。
- 工作台关键统计在加载完成前不得显示误导性的 `0`。

---

## 5. 数据真实性规则

团队主页所有数据必须满足以下任一条件：

1. 来源于后端接口返回字段。
2. 来源于前端对真实接口数据的确定性计算。
3. 是明确的静态枚举文案，例如角色名称、状态名称、tab label。
4. 是明确空态，不被包装成业务事实。

禁止：

- 用随机数、伪随机数、写死数组冒充业务统计。
- 用默认团队名、默认用户、默认角色冒充当前上下文。
- 用全队数据兜底个人数据。
- 用 “本周”“本月”“活跃”“推荐”“平均耗时” 等词描述没有真实时间窗口或统计依据的数据。

---

## 6. 建议改造顺序

### 阶段 1: 修复导航与上下文

1. 为 `TeamSidebar` 接入统一 route map。
2. 让 `AdminShell` / `MemberShell` 传入导航函数。
3. 收敛当前团队上下文来源。
4. 顶部团队切换后更新工作台当前团队。

### 阶段 2: 收敛角色与权限

1. 用当前团队 membership 替换 `useRole()` query 模式。
2. 前端按真实角色选择 Admin / Member 页面。
3. 后端为审核、团队 Skill、套件写操作补团队权限校验。

### 阶段 3: 清理工作台伪数据

1. Admin Dashboard 删除或改写伪趋势、伪增量、伪活跃成员。
2. Member Dashboard 删除“别人数据兜底我的提交”。
3. 对无真实接口支撑的区块使用空态、隐藏或禁用。

### 阶段 4: 整理可点击控件

1. 已有页面承接的按钮改为跳转。
2. 已有接口承接的按钮补 mutation 状态。
3. 无承接能力的按钮禁用或隐藏。

### 阶段 5: 补生产状态与验证

1. 补 loading / empty / error / forbidden 状态。
2. 补前端路由与数据真实性测试。
3. 补后端权限测试。

---

## 7. 验收标准

### 7.1 导航验收

- 在 `/team` 点击左侧每个菜单项，URL 与页面内容必须变化到对应 route。
- Admin 与 Member 菜单只展示其角色可访问的现有页面。
- 当前 active 菜单必须与 URL 对应。

### 7.2 团队上下文验收

- 顶部切换团队后，工作台中的团队名、Skill 数、成员数、审核队列、活动流必须来自新团队。
- 直接刷新页面后，当前团队上下文不丢失或能回到明确默认值。
- 用户无团队时进入 `NoTeamPage`，不能显示默认团队数据。

### 7.3 角色权限验收

- Admin 用户进入 Admin 工作台。
- Member 用户进入 Member 工作台。
- Member 直接访问 `/team/reviews` 或调用审核决策接口必须被拒绝。
- 非团队成员访问团队私有数据必须被拒绝。

### 7.4 数据真实性验收

- 团队主页代码中不得保留业务伪数据常量：
  - `CHART_DATA`
  - `WEEKLY_DELTAS`
  - 硬编码当前团队名
  - 硬编码当前用户 handle/name/email
  - 伪 Token 列表
- “本周”“本月”“活跃”“推荐”“平均处理时长”等字样必须有真实数据来源；否则删除或改成中性描述。
- “我的提交”为空时展示空态，不展示全队审核记录。

### 7.5 交互验收

- 页面内所有看起来可点击的按钮都必须具备真实行为或禁用态。
- 禁用态按钮不得触发请求。
- 已接 mutation 的按钮必须有 loading 和失败反馈。

### 7.6 验证命令

前端：

```bash
cd frontend
npm run lint
```

后端：

```bash
cd backend
mvn test
```

手工冒烟：

```bash
./scripts/services.sh start
```

- 访问 `http://localhost:5173/team`。
- 使用默认账号进入团队工作台。
- 逐项点击左侧菜单。
- 切换团队并确认数据随团队变化。
- 用 Member 角色账号验证 Admin-only 页面与接口不可访问。

---

## 8. 风险与约束

- 当前仓库存在未提交改动，实施时必须避免覆盖无关改动。
- 后端权限补齐会改变原型阶段“前端控制入口”的假设，需补回归测试。
- 删除伪指标会让工作台短期看起来更少内容，但这是生产可信度要求，不是功能缩水。
- 如已有某些按钮只是设计稿占位，生产版本必须显式降级为隐藏或禁用。

---

## 9. 后续计划建议

本 spec 确认后，再单独生成 implementation plan。计划应按以下可独立验证的任务拆分：

1. 导航与当前团队上下文。
2. 角色来源与前端路由分流。
3. 后端团队权限校验。
4. Admin Dashboard 伪数据清理。
5. Member Dashboard / MySubmissions 数据真实性修复。
6. 偏好页与无效按钮降级。
7. 状态与测试补齐。
