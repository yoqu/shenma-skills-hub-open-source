# SkillStack 生产级测试用例总表

更新时间：2026-05-21  
适用仓库：`/Users/yoqu/Documents/code/self/skill-team-share`  
来源：静态代码探索 + 子 agent 分模块只读分析，尚未执行运行态验证。

## 1. 使用说明

本文件是后续反复执行测试的主入口，覆盖界面、接口、功能、安全、回归、E2E 与响应式检查。执行时建议把每条用例补充执行状态：`TODO / PASS / FAIL / BLOCKED`、执行人、执行时间、缺陷链接、环境快照。

优先级含义：

- `P0`：上线门禁。失败通常代表核心链路、权限、安全或数据一致性不可接受。
- `P1`：重要回归。失败会影响主要体验、运营效率或后续自动化稳定性。
- `P2`：增强覆盖。主要覆盖可用性、占位能力、视觉与边缘场景。

建议执行顺序：

1. `P0 API/安全`：先跑权限、状态泄露、核心写入链路。
2. `P0 E2E/UI`：再跑登录、团队、创建、审核、套件等主路径。
3. `P1 回归/边界`：覆盖分页、搜索、状态显示、重复操作和错误提示。
4. `P2 响应式/占位能力`：最后做视觉和未闭环入口确认。

## 2. 模块功能地图

| 模块 | 子模块 | 前端入口 | 主要 API | 后端入口 | 核心状态 / 权限 |
|---|---|---|---|---|---|
| 认证与账户 | 短信登录、密码登录、注册四步、当前用户 profile、改密码、改手机号、公开用户页 | `/login`、`/register`、`/profile`、`/u/:handle`、`TopBar` | `/api/auth/**`、`/api/me`、`/api/me/profile`、`/api/me/password`、`/api/me/phone`、`/api/users/{handle}` | `AuthController`、`UserController`、`AuthService`、`UserService`、`JwtAuthFilter` | `/api/auth/**` 与公开用户页放行；`/api/me*` 必须 JWT；手机号唯一；短信验证码一次性 |
| 团队工作区 | 当前团队上下文、角色分流、Admin/Member dashboard、无团队加入 | `/team`、`RoleAware`、`NoTeamPage`、`TeamSidebar` | `/api/teams/mine`、`/api/teams/{slug}`、`/api/teams/join-by-code`、`/api/teams/{teamId}/activity` | `TeamController`、`InviteService`、`ActivityController` | `OWNER/ADMIN` 进 admin，`MEMBER/VIEWER` 进 member；邀请码有 active/exhausted/expired/revoked |
| 成员与邀请 | 成员列表、角色调整、移除、邀请码、手机号定向邀请 | `/team/members`、`/team/invites` | `/api/teams/{teamId}/members`、`/api/teams/{teamId}/invites/**` | `TeamMemberController`、`TeamInviteController`、`TeamMemberService`、`InviteService` | Admin/Owner 应可写；成员浏览只读；手机号邀请状态 pending/accepted/declined/expired |
| 团队设置 | 基本信息、审核模式、公开主页、危险操作占位 | `/team/settings` | `/api/teams/{teamId}/settings` | `TeamController`、`TeamService` | `name/description/avatarChar/color/reviewMode/publicHome` 可保存；`slug` 只读 |
| Skill 公共与团队库 | 首页、广场、详情、版本、下载、安装、star、分类/标签、团队库 | `/`、`/plaza`、`/skills/:slug`、`/team/skills` | `/api/skills`、`/api/skills/{slug}`、`/api/skills/{slug}/versions`、`/api/skills/{slug}/download`、`/api/teams/{teamId}/skills`、`/api/categories` | `SkillController`、`SkillService`、`SkillVersionService`、`SkillDownloadService`、`CategoryController` | 公共广场应只展示 `PUBLIC + APPROVED`；团队库应受 team membership 约束 |
| Skill 创建与审核 | 创建四步、草稿占位、审核队列、审核详情、approve/reject/request-changes、我的提交 | `/create/skill`、`/team/reviews`、`/team/mine` | `POST /api/skills`、`/api/skills/me/drafts`、`/api/teams/{teamId}/reviews`、`/api/reviews/{id}/approve|reject|request-changes` | `SkillService`、`ReviewController`、`ReviewService` | 当前创建始终进入 `PENDING_REVIEW`；审核决策应限 Admin/Owner |
| Suite / Collection | 套件创建、管理员列表与排序、成员浏览安装、删除 API、公共团队页套件展示 | `/create/suite`、`/team/suites`、`/teams/:slug` | `/api/teams/{teamId}/suites`、`/api/suites/{slug}`、`/api/suites/{id}/items`、`/api/suites/{id}`、`/api/suites/{id}/install` | `SuiteController`、`SuiteService` | `visibility=PUBLIC/TEAM_PRIVATE`；suite slug 数据库唯一键是 `(team_id, slug)` |
| 通用壳层与响应 | TopBar、TeamSidebar、AdminShell、MemberShell、API envelope、错误处理、响应式 | 全站 | Axios client、`ApiResponse<T>` | `SecurityConfig`、`GlobalExceptionHandler` | 公开接口白名单明确；业务异常 envelope 为 `{code,message,data}` |

## 3. 测试数据基线

可直接复用 seed：

- Owner：`lin_zr / password`，team1 `ludou-fe` 的 `OWNER`。
- 多团队 Admin：`zhao_yc / password`，team1 `ADMIN`，team2/team3 `MEMBER`，team4 `VIEWER`。
- Member：`chen_yx / password`，team1 `MEMBER`。
- 其他成员：`mo_jr / password` 等，可覆盖普通资料页和少 Skill 场景。
- 邀请码：`LD-FE-7K3M`、`LD-FE-INTERN-26`、`LD-FE-LEAD-Q2`、`LD-FE-OLD-X1`。
- 现有 Skill：6 条 `PUBLIC + APPROVED`，2 条 `TEAM_PRIVATE + APPROVED`。
- 现有 Suite：`onboard`、`daily-fe`、`release-ops`、`open-source`。

建议补充夹具：

- `user_outsider_auth`：已登录但不属于 team1，用于越权访问。
- `user_no_team`：无任何 `team_members` 记录，用于 NoTeamPage 和空态。
- `team_public_home_off`：`public_home=0`，用于公共页隐藏策略。
- Skill 状态矩阵：`PUBLIC/TEAM_PRIVATE` x `DRAFT/PENDING_REVIEW/APPROVED/REJECTED/UNLISTED`。
- Review 状态矩阵：`PENDING_REVIEW`、`APPROVED`、`REJECTED`、`request-changes` 后样本。
- Suite 样本：empty suite、同步 count 的 public suite、跨团队同 slug suite、跨团队 item 引用。
- 活动流：至少 25 条，覆盖 `approve/submit/invite/release/unlist/join/suite/reject`。
- 手机邀请：补 `expired`、重复手机号、非法手机号格式。

短信验证码策略：

- 生产级自动化不要依赖日志抓取验证码。
- UI/E2E 使用非生产短信沙箱或测试 OTP sink。
- API/集成测试建议通过 test profile 注入可观测 SMS adapter。
- 不在测试文档、脚本或报告中保存真实 JWT secret、Bearer token、生产手机号或真实邮箱。

## 4. 已知高风险回归点

| 风险ID | 风险 | 影响 | 关键测试 |
|---|---|---|---|
| RISK-AUTH-01 | “7 天内免登录”只是 UI 勾选，token 存储和 TTL 无差异 | 会话策略与产品语义不一致 | `AUTH-009` |
| RISK-AUTH-02 | `useSession()` 可能在坏 token 或无 token 时自动登录 `DEV_LOGIN` | 生产环境安全风险 | `AUTH-010`、`ACC-021`、`SEC-001` |
| RISK-TEAM-01 | 无团队用户或失效 `currentTeamId` 可能白屏 | 新用户无法进入团队空态 | `TEAM-CTX-002`、`TEAM-CTX-004` |
| RISK-TEAM-02 | 成员列表、活动流、团队 Skill、审核、Suite 存在 membership/role 校验缺口 | 跨团队数据泄露或越权写入 | `TEAM-MEM-003`、`TEAM-ACT-002`、`SKILL-TLIB-001`、`REV-001`、`SUITE-020` |
| RISK-PUBLIC-01 | `publicHome=false` 已可保存但公共 list/detail 未过滤 | 私有团队可能仍被公开访问 | `TEAM-SET-004`、`SUITE-019` |
| RISK-SKILL-01 | 未审核/拒绝 public Skill 可能通过 slug detail/version/download 暴露 | 未发布内容泄露 | `SKILL-DTL-003` |
| RISK-SKILL-02 | star/unstar 纯计数加减，无幂等和非负保护 | 数据污染 | `SKILL-ACT-002` |
| RISK-REV-01 | request-changes 无 UI 闭环，member 侧状态映射会把 `REJECTED` 当“需改动” | 审核语义错乱 | `REV-004`、`SUB-002` |
| RISK-SUITE-01 | Suite detail 只按 slug 查，不按 `(team, slug)` 查 | 同 slug 跨团队串数据 | `SUITE-022` |
| RISK-SUITE-02 | 公共团队页复用登录态 team hooks | 匿名看不到公开套件，登录时可能串当前团队数据 | `SUITE-017`、`SUITE-018` |
| RISK-UI-01 | 多处按钮为占位，无真实行为 | 用户误操作、测试假通过 | `UI-ACTION-001` |

## 5. 测试用例总表

### 5.1 认证、注册、账户、公开用户

| 用例ID | 层级 | 场景 | 前置条件 | 步骤 | 预期结果 | 优先级 | 自动化建议 |
|---|---|---|---|---|---|---|---|
| AUTH-001 | UI | 登录页验证码发送成功 | 未登录；测试短信通道可用 | 打开 `/login`，输入 `13800002046`，点击获取验证码 | 出现倒计时与 OTP 输入框，无错误提示 | P0 | Playwright + OTP sink |
| AUTH-002 | UI/API | 手机号格式校验 | 未登录 | 分别输入空、10 位、字母混入手机号发码 | 前端阻止或 API 400，错误明确 | P0 | Playwright + API 参数化 |
| AUTH-003 | API | OTP 一次性消费和过期 | 可获取测试验证码 | 发码后正确登录，再复用同码，再过期后使用 | 首次成功；复用和过期失败 | P0 | SpringBootTest / RestAssured |
| AUTH-004 | E2E | 已注册手机号验证码登录 | seed 用户存在 | 完成短信登录 | token 写入；跳转 `/team`；TopBar 显示用户菜单 | P0 | Playwright |
| AUTH-005 | 功能 | 未注册手机号短信登录 | 测试手机号未注册 | 发码并登录 | 后端拒绝“手机号未注册”；若 UI 仍写自动创建账号，记录文案缺陷 | P1 | E2E + 文案断言 |
| AUTH-006 | API | 密码登录支持 handle/email/phone | seed 用户存在 | 分别用三种 identifier + `password` 登录 | 均返回 token 和 user | P0 | API 参数化 |
| AUTH-007 | API/UI | 密码登录负向 | seed 用户存在 | 错密码、空密码、空 identifier、超长字段 | 登录失败；错误提示明确；无 token 残留 | P0 | API + UI |
| AUTH-008 | 回归 | 退出登录清理会话 | 已登录 | TopBar 菜单点击退出，刷新页面 | `skillstack.jwt` 清空；React Query 缓存清空；刷新仍未登录 | P0 | Playwright localStorage 断言 |
| AUTH-009 | 安全/回归 | “7 天内免登录”语义 | 已知 JWT TTL 策略 | 勾选和不勾选分别登录，对比 token 存储与过期 | 产品预期应有差异；当前若无差异，记录缺陷 | P0 | API + 前端存储断言 |
| AUTH-010 | 安全 | 坏 token 不得自动登录 DEV 账号 | localStorage 写入坏 token | 访问带 TopBar 登录态页面 | 应清 token 并回登录；不得静默变成 `zhao_yc` | P0 | Playwright + network 断言 |
| REG-001 | UI | 注册 step1 gating | 打开 `/register` | 依次验证未勾协议、手机号不完整、邀请码不足、joinMode none | 只有满足条件才能进入下一步 | P0 | Playwright |
| REG-002 | API | 注册 step1 重复手机号 | seed 手机号 | 调 `POST /api/auth/register/step1` | 返回“手机号已注册，请直接登录” | P0 | API |
| REG-003 | API | step2 handle/email 规则 | 有合法 regToken | 传非法 handle、重复 handle、非法 email、重复 email | 返回对应校验或占用错误 | P0 | API 参数化 |
| REG-004 | API | regToken 跳步/过期/伪造 | 无效或过期 regToken | 直接调 step3/step4 | 返回注册令牌无效或流程未完成 | P0 | SpringBootTest |
| REG-005 | E2E | 注册个人账号成功 | 动态手机号/handle/email；可取 OTP | 完整走四步，不填邀请码 | 用户创建成功；返回 token；可进入 `/team` | P0 | Playwright + DB 断言 |
| REG-006 | E2E | 注册并通过有效邀请码入团 | 使用 `LD-FE-7K3M` 或 `LD-FE-LEAD-Q2` | 完整注册并填写邀请码 | 用户创建；`team_members` 新增；角色与邀请码一致 | P0 | E2E + DB |
| REG-007 | API | 无效/过期/用尽邀请码回滚 | 动态账号；无效或 `LD-FE-OLD-X1` | step4 提交邀请码 | 返回失败；`users` 不残留新用户；团队人数不变 | P0 | 事务集成测试 |
| REG-008 | 回归 | step3 资料契约一致性 | 注册完成 | 设置 avatarColor/bio，查看 `/u/:handle` 和 `/profile` | 当前若只保存 avatar 字符，不得把 bio/avatarColor 当已生效功能 | P1 | API + UI |
| ACC-001 | E2E | 未登录访问 `/profile` | 清空 token | 直接打开 `/profile` | 跳 `/login`，不显示账号表单 | P0 | Playwright |
| ACC-002 | 安全 | `/profile` 坏 token 行为 | 写入坏 token | 访问 `/profile` | fail closed：清 token 并回登录；不得 DEV 自动登录 | P0 | Playwright |
| ACC-003 | 功能 | `/api/me` 回填 profile | 已登录 seed 用户 | 打开 `/profile` | handle/name/email/phone/头像正确回填 | P0 | Playwright |
| ACC-004 | 回归 | 更新基本资料并刷新 session | 已登录 | 改 name/email/avatar 保存 | 成功提示；TopBar 和表单同步新值 | P0 | Playwright + network |
| ACC-005 | API/UI | 更新资料负向 | 已登录 | 空 name、非法 email、重复 email、超长 avatar | 返回字段错误；数据库不更新 | P0 | API + UI |
| ACC-006 | API | 修改密码成功 | 已登录 | 正确当前密码 + 新密码，随后访问 `/api/me` 并重新登录 | 当前 token 仍有效；新密码可登录 | P0 | API |
| ACC-007 | API/UI | 修改密码负向 | 已登录 | 错当前密码、新密码过短、确认不一致 | 返回错误；旧密码仍有效；登录态不误清理 | P0 | API + UI |
| ACC-008 | API | 修改手机号成功 | 新手机号未占用；可取 OTP | 发新号验证码，提交当前密码 + 新号 + OTP | `/api/me` 返回新手机号；旧号不可登录，新号可登录 | P0 | API + DB |
| ACC-009 | API | 修改手机号负向 | 已登录 | 错密码、错 OTP、过期 OTP、复用 OTP、已占用手机号 | 数据库不更新；错误明确 | P0 | API 参数化 |
| USER-001 | E2E | 公开用户页只展示公开已审 Skill | 已知 handle | 打开 `/u/zhao_yc` | 资料正常；只出现 `PUBLIC + APPROVED` Skill | P0 | Playwright + API |
| USER-002 | UI | 公开用户页不存在 handle 和占位能力 | 不存在 handle | 访问不存在用户；检查关注/私信按钮 | 错误/空态清晰；未接后端能力不得误宣称可用 | P1 | Playwright |

### 5.2 团队、成员、邀请、设置、活动流

| 用例ID | 层级 | 场景 | 前置条件 | 步骤 | 预期结果 | 优先级 | 自动化建议 |
|---|---|---|---|---|---|---|---|
| TEAM-CTX-001 | UI/E2E | 首次进入自动选中第一个团队 | 多团队 admin；清空 `skillstack:currentTeamId` | 登录访问 `/team` | 自动选中我的第一个团队；dashboard、sidebar 数据一致 | P0 | Playwright |
| TEAM-CTX-002 | UI/回归 | 失效 teamId/slug 恢复策略 | localStorage 写不存在 team | 访问 `/team`、`/team/members` | 不白屏；回退有效 team 或明确错误/空态 | P0 | Playwright |
| TEAM-CTX-003 | UI/E2E | role-aware 分流 | owner/admin/member/viewer 账号 | 访问 `/team`、`/team/members`、`/team/suites` | Owner/Admin 进 admin；Member/Viewer 进 member；菜单正确 | P0 | Playwright |
| TEAM-CTX-004 | UI/E2E | 无团队用户空态 | `user_no_team` | 访问 team 共享路由 | 进入可操作 NoTeamPage，不白屏 | P0 | Playwright |
| TEAM-CTX-005 | 安全/E2E | member 手工访问 admin route | member 用户 | 访问 `/team/invites`、`/team/settings` | 前端拦截或后端 403；不展示 admin 数据 | P0 | Playwright + API |
| TEAM-SET-001 | API | writer 获取并保存团队设置 | owner/admin | GET settings；PUT 修改 name/description/avatarChar/color/reviewMode/publicHome | 200；再次 GET 与 DB 一致；未提交字段不丢 | P0 | MockMvc/RestAssured |
| TEAM-SET-002 | 安全/API | member/non-member 访问 settings | member、outsider | GET/PUT `/settings` | 403 或业务拒绝；不泄露设置 | P0 | API |
| TEAM-SET-003 | API | `reviewMode` 非法值 | writer | PUT `reviewMode=XXX` | 400，错误明确 | P0 | API |
| TEAM-SET-004 | 功能/安全 | `publicHome=false` 隐藏团队 | `team_public_home_off` | 调 `/api/teams` 和 `/api/teams/{slug}` | 不应公开暴露该 team | P0 | API 集成 |
| TEAM-SET-005 | UI/回归 | 审核模式展示联动 | writer | 设置 `DIRECT_PUBLISH` 后刷新 admin/member dashboard | dashboard 不应继续写死“需要审核” | P1 | Playwright |
| TEAM-SET-006 | UI/回归 | slug/logoUrl/危险操作契约 | writer | 尝试改 slug/logoUrl，点击危险操作 | 只读项不可编辑；未实现操作应禁用或说明 | P2 | Playwright |
| TEAM-MEM-001 | API | 成员列表分页筛选排序 | team1 seed | GET `page=1&size=3`、`role=ADMIN`、`q=赵` | page/size/total/items 正确；按角色排序；q 命中姓名/handle | P0 | API |
| TEAM-MEM-002 | API | 不存在 team 成员列表 | 已登录 | GET `/teams/999999/members` | 404 或明确业务错误 | P1 | API |
| TEAM-MEM-003 | 安全/API | non-member 不可读成员列表 | outsider | GET `/teams/1/members` | 403；不返回成员资料 | P0 | API |
| TEAM-MEM-004 | UI/API | admin 调整成员角色 | owner/admin + member | UI 改成 Admin 或 API PUT | 列表刷新；DB 更新；Owner 不可作为目标 | P0 | E2E + API |
| TEAM-MEM-005 | 安全/API | 不能修改/移除 Owner | owner/admin | PUT role=OWNER；DELETE owner | 403；错误明确 | P0 | API |
| TEAM-MEM-006 | 功能/API | 移除成员并同步人数 | owner/admin + 非 owner member | DELETE member | `team_members` 删除；`members_count -1` | P0 | SpringBootTest + DB |
| TEAM-MEM-007 | UI | member 成员页只读搜索 | member | 打开 `/team/members`，切 tab，搜索姓名/handle | 只读，无角色修改入口；搜索结果正确 | P1 | Playwright |
| TEAM-INV-001 | API | 邀请码列表/创建/撤销 | writer | GET codes；POST create；DELETE revoke | 排序、状态、次数、角色正确 | P0 | API |
| TEAM-INV-002 | API | 邀请码参数边界 | writer | max=0/1/200/201；days=0/1/365/366；role=VIEWER/XXX | 合法通过；非法 400 | P1 | API 参数化 |
| TEAM-INV-003 | E2E | 无团队用户有效邀请码入团 | no-team + active code | NoTeamPage 输入 code | 创建成员；返回 team；进入 team workspace；used+1 | P0 | E2E + DB |
| TEAM-INV-004 | UI/API | 邀请码错误反馈 | no-team | 提交 blank/invalid/expired/exhausted/revoked | API 错误明确；UI 不混成笼统失败 | P0 | Playwright + API |
| TEAM-INV-005 | 并发/API | 重复 join 幂等 | 已是成员 + active code | 同用户连续 join 两次 | 不重复建成员；不额外消耗邀请码次数 | P0 | SpringBootTest + DB |
| TEAM-INV-006 | 并发/API | 单次邀请码并发抢占 | `max_uses=1`，两个用户 | 并发 join | 仅 1 成功；used 不超发 | P0 | 并发集成测试 |
| TEAM-PHONE-001 | API | 手机邀请脱敏与状态完整 | writer；含 expired | GET phones | 仅返回 masked；状态完整；排序正确 | P0 | API |
| TEAM-PHONE-002 | UI/API | 批量手机号邀请 | writer | 输入多行手机号发送 | 空行忽略；逐行创建；列表刷新 | P1 | Playwright + API |
| TEAM-PHONE-003 | API | 取消手机号邀请状态机 | pending/accepted/declined/expired | 对各状态 cancel | 仅 pending 可取消，其余 400 | P0 | API |
| TEAM-PHONE-004 | API | 非法/重复手机号处理 | writer | 发送 `abc123`、过短、超长、重复号码 | 生产预期拒绝或去重；当前若放行，记录缺陷 | P1 | API |
| TEAM-PHONE-005 | UI/回归 | expired 手机邀请展示 | 准备 expired | 打开手机号邀请表 | 不应显示成 pending | P1 | Playwright |
| TEAM-ACT-001 | API | 活动流 limit 与排序 | 25+ 活动 | GET limit=0/1/8/20/200/500 | clamp 到 1..200；倒序；字段完整 | P0 | API |
| TEAM-ACT-002 | 安全/API | non-member / nonexistent team 活动流 | outsider；不存在 team | GET activity | non-member 403；不存在 team 404 | P0 | API |
| TEAM-ACT-003 | UI/E2E | admin/member 活动流差异 | admin 与 member | 分别打开 dashboard | admin 全量；member 隐藏 invite/unlist；badge 正确 | P1 | Playwright |
| TEAM-PREF-001 | UI | 多团队偏好页 team-aware | multi-team 用户 | 切 team 后访问 `/team/prefs` | 团队名跟随当前 team，不硬编码 `麓豆前端组` | P2 | Playwright |
| TEAM-PREF-002 | UI | 偏好/Token/离队占位能力 | member | 点击保存、Token、离队 | 要么持久化，要么禁用/说明未开放 | P2 | Playwright |

### 5.3 Skill、广场、详情、创建、审核、我的提交

| 用例ID | 层级 | 场景 | 前置条件 | 步骤 | 预期结果 | 优先级 | 自动化建议 |
|---|---|---|---|---|---|---|---|
| SKILL-PLZ-001 | UI/E2E | 公共广场只展示公开已审核 Skill | 存在 public/private/pending/rejected | 打开 `/plaza` | 仅 `PUBLIC + APPROVED` 出现 | P0 | Playwright + fixture |
| SKILL-PLZ-002 | UI | 广场本地搜索 | 准备仅 tag/lang 命中样本 | 输入名称、slug、tag、lang | 当前已拉取列表内过滤正确；空结果明确 | P1 | Playwright |
| SKILL-PLZ-003 | 回归/UI | 广场 >48 条搜索分页 | public approved >48 | 搜索第 49 条，检查分页/滚动 | 不应静默丢失结果；若只能搜当前页，记录缺陷 | P1 | E2E + seed 扩容 |
| SKILL-DTL-001 | API/E2E | 匿名访问 public approved 详情 | public approved 存在 | GET detail，打开详情页 | 200；字段完整；页面渲染正常 | P0 | API + Playwright |
| SKILL-DTL-002 | 安全/API | 匿名访问 private 详情/下载 | private approved 存在 | 匿名 GET detail/download | 403 或受控错误 | P0 | API |
| SKILL-DTL-003 | 安全/API | 防止 pending/rejected public slug 暴露 | public pending/rejected 存在 | 匿名 GET detail/versions/download | 不可读取未发布或拒绝内容 | P0 | SpringBootTest |
| SKILL-VER-001 | API | 版本历史排序与 latest | 多版本 Skill | GET `/versions` | 按发布时间倒序；仅当前版本 latest | P1 | API |
| SKILL-DL-001 | API/UI | 下载指定版本 Zip | 多版本 Skill | 详情切旧版本并下载 | 文件名含版本；Zip 含预期文件；浏览器成功下载 | P1 | Playwright + unzip |
| SKILL-DL-002 | API | 下载不存在版本 | 传不存在 version | GET download | 当前约定如回退 current version，应明确记录并断言 | P2 | API |
| SKILL-ACT-001 | 功能/API | install 计数递增 | 已登录；installs=N | 连续 install | 返回计数递增；详情刷新；stars 不变 | P1 | API + UI |
| SKILL-ACT-002 | 安全/回归 | star/unstar 幂等与非负 | 已登录；stars=N | 重复 star，重复 unstar | 同一用户不应重复累计；stars 不应为负 | P0 | API + DB |
| SKILL-CRT-001 | E2E | 创建 Skill 提交审核 | admin/member 登录，teamId 有效 | 走完 `/create/skill` 四步提交 | 新增 skills、skill_versions、reviews；状态闭环 | P0 | Playwright + DB |
| SKILL-CRT-002 | API | 创建参数校验 | 已登录 | 非法 slug、空 name、非法 visibility、非法 teamId | 400；不落库 | P0 | API |
| SKILL-CRT-003 | 安全/API | 创建时 team membership 校验 | outsider | POST `/api/skills` 指向 team1 | 应拒绝，不能向他队提交 | P0 | API |
| SKILL-CRT-004 | 功能/回归 | 保存草稿闭环 | 草稿按钮存在 | 点击保存草稿，再查 `/skills/me/drafts` | 若入口保留，应产生 DRAFT；当前若无保存 API，记录缺陷 | P1 | E2E + API |
| SKILL-TLIB-001 | 安全/API | 非成员访问团队 Skill 库 | outsider | GET `/api/teams/1/skills` | 403，不可枚举 private/pending skill | P0 | API |
| SKILL-TLIB-002 | UI/API | 团队库搜索/状态/分页一致 | team skills >50，含 tag-only | admin/member 页按 q/status/visibility 查询 | UI 与 API 一致；分页不丢；tag 搜索语义清楚 | P1 | Playwright + API |
| SKILL-CAT-001 | API/UI | 分类接口与创建页分类一致 | categories seed | GET `/api/categories`，打开创建页分类选择 | 排序、名称、code 一致；创建页不应使用过期本地常量 | P1 | API + UI |
| REV-001 | 安全/API | 只有 OWNER/ADMIN 可审查与决策 | owner/admin/member/outsider | 访问 queue/detail/approve/reject/request-changes | owner/admin 允许；member/outsider 拒绝 | P0 | Spring Security integration |
| REV-002 | 功能/API | approve 联动发布 | pending review | POST approve | review=APPROVED；skill=APPROVED；published_at 写入 | P0 | DB 集成 |
| REV-003 | 功能/API | reject 必填 reason 并可见 | pending review | 空 reason reject，再带 reason reject | 空 reason 400；有效后 review/skill=REJECTED；原因可见 | P0 | API + UI |
| REV-004 | 功能/E2E | request-changes 到提交者闭环 | pending review | admin request-changes，member 打开我的提交 | member 看到“需改动/重新提交”，而非继续审核中 | P0 | E2E + DB |
| REV-005 | UI/回归 | 审核详情使用真实 API | 有 review detail | 打开 `/team/reviews` 选中条目 | 文件树/检查项来自 API 或明确无此能力，不应混用 mock | P1 | Playwright |
| SUB-001 | UI/E2E | 我的提交只看当前提交者 | member 有提交 | 打开 `/team/mine` | 仅显示当前用户提交记录；状态/理由正确 | P0 | Playwright |
| SUB-002 | 回归/UI | 区分 rejected 与 request-changes | 同时存在两类样本 | 打开 `/team/mine` | reject 显示“已拒绝”，request-changes 显示“需改动” | P1 | Playwright snapshot |
| SUB-003 | UI | 评论/回复能力边界 | member | 打开评论弹窗并回复 | 若无后端持久化，不得假装已提交到服务端 | P2 | Playwright |

### 5.4 Suite / Collection、公共团队页、通用壳层

| 用例ID | 层级 | 场景 | 前置条件 | 步骤 | 预期结果 | 优先级 | 自动化建议 |
|---|---|---|---|---|---|---|---|
| SUITE-001 | UI | 创建页默认渲染 | 登录且 team context 可用 | 打开 `/create/suite` | 默认字段、可见性、可选 Skill 列表正常 | P1 | 组件测试 + E2E |
| SUITE-002 | 回归/UI | 创建页 empty suite 边界 | 有 >=5 team skills | 移除全部已选 Skill | 应能稳定保留 empty 或明确禁止；当前自动回填应记录 | P1 | E2E |
| SUITE-003 | 功能/API | 创建 private suite | team1 writer | POST 合法 name/slug/skillIds | 创建成功；列表出现；skills_count 与 items 一致 | P0 | API + UI smoke |
| SUITE-004 | 功能/E2E | 创建 public suite | writer | 创建 PUBLIC suite | 管理端/成员页可见；公共页可展示 | P0 | E2E |
| SUITE-005 | API | 重复 slug 冲突 | team1 已有 `daily-fe` | 再 POST 同 slug | 返回 409 code；前端显示错误 | P0 | API |
| SUITE-006 | API | slug/name/desc 校验 | writer | 非法 slug、空 name、超长 desc | 400；不落库 | P0 | API |
| SUITE-007 | 安全/API | 创建传重复/不存在/跨团队 skillId | 准备非法 skillId | POST suites | 应拒绝；不能接受跨团队 Skill | P0 | Service + API |
| SUITE-008 | UI | 管理员列表/详情一致 | 使用 seed `daily-fe` | 打开 admin suites，比对列表数字/日期/详情 items | 列表与详情一致；现有 seed 的 count mismatch 应暴露 | P1 | E2E |
| SUITE-009 | 功能/UI/API | 拖拽排序保存 | 多 item suite | 拖第 N 项到第 1 位保存并重进 | 顺序持久化；再次拉取一致 | P0 | E2E + API |
| SUITE-010 | API | updateItems 空列表和非法 position | 现有 suite | PUT `[]`、position=0/-1、重复 position | 空列表按产品预期处理；非法 position 拒绝 | P0 | Service/API |
| SUITE-011 | 功能/API | 删除套件与关联影响 | 非公共 suite | DELETE suite | suite/items 逻辑删除；team count -1；列表不再显示 | P0 | API + DB |
| SUITE-012 | 功能/E2E | 成员查看套件详情 | member 登录 | 打开 `/team/suites` 选中套件 | 详情、items、安装命令正确 | P0 | Playwright |
| SUITE-013 | 回归/E2E | 成员一键安装刷新 | installs=0 suite | 点击安装 | 后端 +1；UI 同步刷新 | P0 | E2E + API |
| SUITE-014 | API | 重复安装语义 | 任意 suite | 连续两次 POST install | 明确计数型或幂等型预期；当前每次 +1 应被记录 | P1 | API |
| SUITE-015 | 回归/UI | 安装命令一致性 | team1/team2 有 suite | 查看创建页、admin、member、public 命令 | 命令格式和 team slug 一致；不得硬编码 `ludou-fe` | P0 | 文案快照 |
| SUITE-016 | UI | 无行为按钮兜底 | 相关页面 | 点击新建/取消/预览/复制/单个安装/申请加入 | 可见按钮必须有行为；否则禁用或说明 | P1 | E2E |
| SUITE-017 | E2E/回归 | 公共团队页匿名访问 | 未登录 | 打开 `/teams/ludou-fe` | 团队介绍、公开 Skill、公开 Suite、贡献者可见 | P0 | Playwright |
| SUITE-018 | E2E/回归 | 公共团队页不串当前团队 | 登录并切到 team2 | 打开 `/teams/ludou-fe` | 展示 ludou-fe 的公开数据，不使用当前 team2 数据 | P0 | Playwright |
| SUITE-019 | 安全/API | publicHome=false 公共访问 | `team_public_home_off` | GET public teams/detail，访问前端公共页 | 不公开该 team | P0 | API + E2E |
| SUITE-020 | 安全/API | 非成员访问 team suites list | outsider | GET `/api/teams/1/suites` | 应拒绝 | P0 | API |
| SUITE-021 | 安全/API | 非成员/Viewer 写套件 | outsider 或 viewer | create/update/delete/install | 写操作限 Admin/Owner；读操作按可见性/成员校验 | P0 | API |
| SUITE-022 | 安全/回归 | 同 slug 跨团队详情串用 | team2 有同 slug suite | 调 `/api/suites/{slug}` 并切团队比对 | 必须以 `(team, slug)` 定位；不得串详情 | P0 | API + E2E |
| SUITE-023 | 安全/API | private suite / private skill 泄露 | private suite | outsider 访问 `/api/suites/{slug}` | 不应看到 private suite 或内部 private skills | P0 | API |
| SUITE-024 | API | 错误响应规范 | 404/409/403 场景 | 触发不存在、冲突、无权限 | 返回统一 `{code,message,data}`；前端按 code 处理 | P1 | API |
| SUITE-025 | 回归 | 直接打开页面 team context | 清 cache/localStorage | 直接打开 `/team/suites`、`/create/suite` | 页面自行加载上下文，不依赖 TopBar 预热 | P1 | E2E |
| PUBTEAM-001 | UI/E2E | 公共团队页公开 Skill 过滤 | 公开团队 | 打开 `/teams/ludou-fe` | 只展示该团队公开已审 Skill；加载期间不闪全局 Skill | P0 | Playwright |
| PUBTEAM-002 | E2E | 贡献者跳转公开 Profile | 有 contributors | 点击头像/handle | 进入 `/u/:handle`；不泄露私有 Skill | P1 | Playwright |
| SEC-001 | 安全/API | 公共白名单与受保护接口矩阵 | 无 token、坏 token、有效 token 三组 | 分别请求 `/api/auth/**`、公开 GET、`/api/me*`、team/review/suite 写接口 | 公开接口放行；私有接口拒绝；坏 token 不得提升权限或触发 DEV 自动登录 | P0 | API 矩阵测试 |
| SEC-002 | 安全/API | 跨团队资源访问矩阵 | owner/admin/member/viewer/outsider/no-team | 访问 team skills/members/activity/reviews/suites/detail/update/delete | 只允许符合角色和 membership 的操作；越权返回受控错误 | P0 | API + DB fixture |
| SHELL-001 | UI | TopBar 登录/注册/profile/退出 | 登录和未登录两态 | 检查按钮、菜单、跳转、退出 | 路由正确；状态同步；无布局遮挡 | P0 | Playwright |
| SHELL-002 | UI | TeamSidebar 菜单与计数 | owner/admin/member/viewer | 进入 team 页面 | 菜单符合角色；计数与 API 一致 | P1 | Playwright |
| API-ENV-001 | API | envelope 与错误处理 | 业务错误、鉴权错误 | 触发 validation/business/security error | `{code,message,data}` 语义稳定；401/403 与业务错误区分清楚 | P0 | API |

### 5.5 全站响应式、可访问性、占位入口

| 用例ID | 层级 | 场景 | 前置条件 | 步骤 | 预期结果 | 优先级 | 自动化建议 |
|---|---|---|---|---|---|---|---|
| RESP-001 | UI/回归 | Auth 页面响应式 | 390x844、760x1024、1280x800 | 检查 `/login`、`/register` | 表单可用；OTP/错误提示不溢出；视觉区按断点隐藏 | P1 | Playwright screenshot |
| RESP-002 | UI/回归 | Profile 和公开用户页响应式 | 多视口 | 检查 `/profile`、`/u/:handle` | 双栏不横向溢出；按钮/统计/卡片不遮挡 | P1 | Playwright screenshot |
| RESP-003 | UI/回归 | 团队工作区响应式 | 多视口 | `/team`、`/team/members`、`/team/invites`、`/team/settings` | sidebar 不压正文；表格/面板/输入不截断 | P0 | Playwright screenshot |
| RESP-004 | UI/回归 | Skill 页面响应式 | 多视口 | `/plaza`、`/skills/:slug`、`/create/skill`、`/team/reviews` | 栅格可读；详情双栏可折叠；弹窗/按钮可操作 | P1 | Playwright screenshot |
| RESP-005 | UI/回归 | Suite 页面响应式 | 375/768/1440 | `/create/suite`、admin/member suites、public team | 命令块、侧栏、两栏布局不溢出 | P1 | Playwright screenshot |
| UI-ACTION-001 | UI/功能 | 所有可见按钮有真实行为或禁用说明 | 全站关键页面 | 遍历新建、预览、复制、保存草稿、危险操作、申请加入等按钮 | 可见可点击按钮必须产生可验证结果；未开放则禁用或标注 | P1 | Playwright exploratory |
| A11Y-001 | UI | 表单错误可读性 | 登录/注册/profile/settings/create | 触发表单错误 | 错误文字贴近字段；焦点不丢；键盘可继续操作 | P1 | Playwright + axe 可选 |
| A11Y-002 | UI | 键盘导航 | TopBar、菜单、表单、弹窗 | 仅键盘 Tab/Enter/Esc 操作 | 焦点顺序合理；弹窗可关闭；菜单可选中 | P2 | Playwright |

## 6. 自动化分层建议

| 层级 | 建议工具 | 覆盖内容 | 进入门槛 |
|---|---|---|---|
| 后端 API / 安全 | `SpringBootTest`、`MockMvc`、`REST Assured` | 权限矩阵、参数校验、状态流转、DB 一致性、并发 | P0 必跑 |
| 前端类型/构建 | `npm run lint`、`npm run build` | TypeScript、路由、构建产物 | 每次改前端必跑 |
| 页面 E2E | Playwright | 登录、团队、Skill 创建审核、Suite、公共页、响应式 | P0/P1 主路径 |
| 视觉回归 | Playwright screenshot | 390/768/1280 三档核心页面 | UI 改动后跑 |
| 数据夹具 | Flyway seed + test-only fixture | outsider、no-team、状态矩阵、并发样本 | 自动化稳定前先补齐 |

## 7. 执行记录模板

复制以下模板到每轮测试报告中：

```md
## 测试执行记录

- 执行日期：
- 分支 / commit：
- 环境：local / CI / staging
- 数据库状态：fresh migration / reused / custom fixture
- 前端地址：
- 后端地址：
- 执行范围：P0 / P1 / P2 / 指定模块

| 用例ID | 结果 | 缺陷链接 | 备注 |
|---|---|---|---|
| AUTH-001 | TODO |  |  |
```
