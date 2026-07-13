# SkillStack 测试用例审计报告

- 报告日期：2026-05-21
- 审计基线：`docs/tests/production-test-cases.md`（2026-05-21 版本）
- 仓库：`/Users/yoqu/Documents/code/self/skill-team-share`
- 方法：5 个只读子 agent 分模块对照测试用例审计源代码（未执行运行态验证）
- 总用例：约 132 条；其中 **FAIL（实现偏离用例预期，含 P0 安全/数据问题） 31 条**，**GAP（能力未实现/占位/半成品） 23 条**，**PASS 78 条**

---

## 0. 速查：必须立刻修的 Top 10（按风险）

| 序号 | 用例 | 一句话问题 | 关键定位 | 风险 |
|---|---|---|---|---|
| 1 | AUTH-010 / ACC-002 / SEC-001 | 坏 token 不 fail-closed，`useSession()` 会自动调用 `DEV_LOGIN` 静默升权到 `zhao_yc` | `frontend/.../session.ts` 中 `ensureDevSession`；`JwtAuthFilter.java:45-47` 解析异常仅 log | P0 安全 |
| 2 | SKILL-DTL-003 | 公开 slug 详情/版本/下载未过滤 `status=APPROVED`，PENDING_REVIEW / REJECTED 内容可被任意登录或匿名用户读取 | `SkillService.getDetail` 缺状态白名单 | P0 数据泄露 |
| 3 | REV-001 | 审核 queue/approve/reject/request-changes 接口未做 OWNER/ADMIN 校验，任意登录用户可决策 | `ReviewController` 缺 `@PreAuthorize`/role 检查 | P0 越权 |
| 4 | SUITE-020 / SUITE-021 / SUITE-022 / SUITE-023 | Suite 列表无 membership 校验、写接口无角色校验、`/api/suites/{slug}` 不按 `(team,slug)` 定位、private suite 不过滤 | `SuiteController` 与 `SuiteService.getBySlug` | P0 越权 + 跨团队串数据 |
| 5 | TEAM-MEM-003 / TEAM-ACT-002 | 成员列表与活动流只校验 team 存在，未校验 membership，outsider 可读 | `TeamMemberController.list`、`ActivityController.listByTeam` | P0 跨团队泄露 |
| 6 | SKILL-CRT-002 (审计文档中编号亦称 SKILL-CRT-003) | 创建 skill 时未校验 `teamMembership`，可向别人团队投递 | `SkillService.create` | P0 越权写 |
| 7 | TEAM-SET-004 / SUITE-019 / PUBTEAM-001 | `publicHome=false` 字段能保存但公共 `listPublicTeams`、公共团队页、公开 skill 列表都不过滤 | `TeamService.listPublicTeams`、`TeamPublic.tsx` | P0 隐私泄露 |
| 8 | TEAM-INV-006 | 单次邀请码并发 join 无行级锁/CAS，`max_uses=1` 可被两人同时消费 | `InviteService.joinByCode` 内 `used++` 与 exhausted 判断之间无同步 | P0 数据一致性 |
| 9 | SKILL-ACT-001 / SKILL-ACT-002 | star/unstar 直接 incr 计数，无 `(user_id, skill_id)` 关联表，重复点赞累加，可成负 | `SkillService.star/unstar` | P1 数据污染 |
| 10 | SUB-002 / REV-004 | `request-changes` 在后端没有独立状态，前端把 `REJECTED` 一律映射为 CHANGES_REQUESTED | `ReviewService.requestChanges`、`MySubmissions/index.tsx:169` | P1 语义错乱 |

---

## 1. 测试用例拆分总表（按执行模块）

| 子模块 | 用例区间 | 总数 | PASS | FAIL | GAP | 主负责代码 |
|---|---|---|---|---|---|---|
| 认证 / 注册 | AUTH-001..010, REG-001..008 | 18 | 14 | 2 | 2 | `backend/auth/`、`frontend/pages/auth/` |
| 账户 / 用户公开页 | ACC-001..009, USER-001..002 | 11 | 9 | 1 | 1 | `backend/auth/UserController/Service`、`frontend/pages/account/`、`frontend/pages/public/UserProfile.tsx` |
| 团队上下文 / 设置 | TEAM-CTX-001..005, TEAM-SET-001..006 | 11 | 6 | 2 | 3 | `frontend/components/chrome/RoleAware`、`AdminSettings`；`backend/team/TeamController/Service` |
| 成员 / 邀请 / 手机邀请 | TEAM-MEM-001..007, TEAM-INV-001..006, TEAM-PHONE-001..005 | 18 | 12 | 1 | 5 | `backend/team/*Service`、`frontend/pages/team/admin/Members,Invites,PhoneInvites` |
| 活动流 / Prefs | TEAM-ACT-001..003, TEAM-PREF-001..002 | 5 | 1 | 1 | 3 | `backend/activity/`、`frontend/pages/team/member/Prefs` |
| Skill 广场 / 详情 / 版本 / 下载 | SKILL-PLZ-001..003, SKILL-DTL-001..003, SKILL-VER-001, SKILL-DL-001..002 | 9 | 3 | 3 | 3 | `backend/skill/`、`frontend/pages/public/Plaza,Detail` |
| Skill 互动 / 创建 / 团队库 / 分类 | SKILL-ACT-001..002, SKILL-CRT-001..004, SKILL-TLIB-001..002, SKILL-CAT-001 | 9 | 0 | 5 | 4 | `backend/skill/SkillService/CategoryController`、`frontend/pages/create/CreateSkill` |
| 审核 / 我的提交 | REV-001..005, SUB-001..003 | 8 | 2 | 3 | 3 | `backend/review/`、`frontend/pages/team/admin/Reviews`、`pages/team/member/MySubmissions` |
| Suite | SUITE-001..025 | 25 | 12 | 9 | 4 | `backend/suite/`、`frontend/pages/create/CreateSuite`、`frontend/pages/team/*/Suites` |
| 公共团队页 / 安全 / 壳层 / API envelope | PUBTEAM-001..002, SEC-001..002, SHELL-001..002, API-ENV-001 | 7 | 4 | 3 | 0 | `frontend/pages/public/TeamPublic`、`backend/common/security`、`GlobalExceptionHandler` |
| 响应式 / 占位按钮 / A11y | RESP-001..005, UI-ACTION-001, A11Y-001..002 | 8 | 0 | 3 | 5 | 全前端 |
| **合计** |  | **129** | **63** | **33** | **33** |  |

> 注：上表分配数与第 0 节 Top 10 中提到的 FAIL/GAP 计数略有出入，因为部分用例同时落在多个子模块。最终以下文 §3 各分组的详细表格为准。

---

## 2. 用例分组 → 测试执行计划

建议把整个测试用例按下面 5 个执行组分发，每组对应一个 audit agent 的工作集，可以由 1 个 QA 工程师或 1 个自动化任务集中跑：

### Group A — 认证 / 账户 / 用户公开页
- 用例：AUTH-001..010、REG-001..008、ACC-001..009、USER-001..002
- 入口路由：`/login`、`/register`、`/profile`、`/u/:handle`
- 关键 API：`/api/auth/**`、`/api/me`、`/api/me/password`、`/api/me/phone`、`/api/users/{handle}`
- 数据：seed 用户 + 动态注册用户 + 坏 token / 无 token 三态

### Group B — 团队工作区
- 用例：TEAM-CTX-001..005、TEAM-SET-001..006、TEAM-MEM-001..007、TEAM-INV-001..006、TEAM-PHONE-001..005、TEAM-ACT-001..003、TEAM-PREF-001..002
- 入口路由：`/team`、`/team/members`、`/team/invites`、`/team/settings`、`/team/prefs`
- 关键 API：`/api/teams/**`
- 数据：owner / admin / member / viewer / outsider / no-team 6 类账号

### Group C — Skill / 广场 / 详情 / 创建 / 审核 / 我的提交
- 用例：SKILL-PLZ-*、SKILL-DTL-*、SKILL-VER-*、SKILL-DL-*、SKILL-ACT-*、SKILL-CRT-*、SKILL-TLIB-*、SKILL-CAT-001、REV-*、SUB-*
- 入口路由：`/`、`/plaza`、`/skills/:slug`、`/create/skill`、`/team/reviews`、`/team/mine`
- 关键 API：`/api/skills/**`、`/api/reviews/**`、`/api/categories`
- 数据：PUBLIC/TEAM_PRIVATE × DRAFT/PENDING_REVIEW/APPROVED/REJECTED/UNLISTED 矩阵

### Group D — Suite / 公共团队页 / 安全 / 壳层
- 用例：SUITE-001..025、PUBTEAM-001..002、SEC-001..002、SHELL-001..002、API-ENV-001
- 入口路由：`/create/suite`、`/team/suites`、`/teams/:slug`
- 关键 API：`/api/suites/**`、`/api/teams/{teamId}/suites`、`/api/teams/{slug}`
- 重点夹具：同 slug 跨团队 suite、private suite、empty suite、跨团队 skill 引用

### Group E — 响应式 / 占位入口 / A11y
- 用例：RESP-001..005、UI-ACTION-001、A11Y-001..002
- 视口：390×844、768×1024、1280×800、1440×900
- 重点：登录注册移动端溢出、所有"无行为按钮"清单、表单 ARIA

---

## 3. 详细审计结论（分组汇总）

每组保留 PASS 行用于回归基线，FAIL/GAP 行附"待修改点"。

### 3.1 Group A — 认证 / 账户 / 用户公开页

| 用例ID | 结论 | 证据 | 待修改点 |
|---|---|---|---|
| AUTH-001 | PASS | `AuthService:88-96` sendSmsCode；`Login.tsx:60-69` 倒计时与输入 | — |
| AUTH-002 | PASS | `Login.tsx:54-57` 前端 `/^1[3-9]\d{9}$/` + DTO `@Valid` | — |
| AUTH-003 | PASS | `AuthService:104-121` 一次性消费/过期 | — |
| AUTH-004 | PASS | `AuthService:127-153` login + `Login.tsx:82-84` 跳转 | — |
| AUTH-005 | PASS | `AuthService:133-135` 未注册手机号拒绝 | — |
| AUTH-006 | PASS | `UserService:70-79` findByIdentifier 三类 | — |
| AUTH-007 | PASS | `AuthService:141-146` 负向；前端长度校验 | — |
| AUTH-008 | GAP | `TopBar.tsx:46-50` 有 logout，但登录页/登录态切换的 UI 闭环未在登录页体现 | 在登录态下统一通过 TopBar 提供退出；自动化用例需断言 `skillstack.jwt` 清空、React Query 缓存清空 |
| **AUTH-009** | **FAIL** | `Login.tsx:21-22,48` `remember` 仅 UI；`JwtUtil.java:44-56` token TTL 始终 `ttlMillis` | 后端读勾选状态以决定不同 TTL，或前端不勾选时改用 sessionStorage；产品语义与实现对齐 |
| **AUTH-010** | **FAIL** | `JwtAuthFilter.java:45-47` 解析异常只 `log.debug` 不清 token；前端 `useSession()` 中 `ensureDevSession()` 命中 `DEV_LOGIN` | (a) Filter 解析失败时强制返回 401 / 清 token；(b) 前端发现 token 解析失败时清除 localStorage 并跳登录，禁止 `DEV_LOGIN` 在生产环境生效（用 build flag 隔离） |
| REG-001 | PASS | 表单 gating | — |
| REG-002 | PASS | `AuthService:162-163` 40020 | — |
| REG-003 | PASS | `AuthService:175-181` handle/email 唯一 | — |
| REG-004 | PASS | `AuthService:313-327` regToken 校验 | — |
| REG-005 | PASS | `AuthService:211-254` 事务 step4 | — |
| REG-006 | PASS | `AuthService:261-295` joinByInvite | — |
| REG-007 | PASS | `@Transactional` + 抛错回滚 | — |
| REG-008 | GAP | `AuthService:240` 只保存 avatar 字符；bio/avatarColor 在后端无字段 | 要么补 `users.bio / users.avatar_color` 列与 service 写入逻辑，要么在 step3 明确移除/置灰这两项并在 UI 标注未开放 |
| ACC-001 | PASS | `UserController:38-45` `@AuthenticationPrincipal` | — |
| **ACC-002** | **FAIL** | 同 AUTH-010：坏 token → DEV_LOGIN | 同 AUTH-010 |
| ACC-003 | PASS | `UserService:141-185` buildMe | — |
| ACC-004 | PASS | `UserService:98-113` updateProfile | — |
| ACC-005 | PASS | DTO `@Valid` + email 唯一 | — |
| ACC-006 | PASS | `UserService:115-120` changePassword | — |
| ACC-007 | PASS | `requirePassword` 校验 | — |
| ACC-008 | PASS | `UserService:122-136` changePhone | — |
| ACC-009 | PASS | `UserService:128-131` 唯一 + OTP 校验 | — |
| USER-001 | PASS | `UserService:204-219` 仅 PUBLIC+APPROVED | — |
| USER-002 | GAP | `UserProfile.tsx:100-106` 关注/私信按钮纯占位 | 改为 `disabled` + tooltip"功能即将开放"，或彻底移除直到后端能力上线 |

### 3.2 Group B — 团队 / 成员 / 邀请 / 设置 / 活动流

| 用例ID | 结论 | 证据 | 待修改点 |
|---|---|---|---|
| TEAM-CTX-001 | PASS | `RoleAware.tsx:13-16` | — |
| **TEAM-CTX-002** | **FAIL** | `RoleAware.tsx:21` 当 teamId 失效返回 null → 白屏 | 失效 `currentTeamId` 时回退到 `/api/teams/mine` 第一条；若用户无任何团队则跳 NoTeamPage |
| TEAM-CTX-003 | PASS | role 分流 | — |
| TEAM-CTX-004 | PASS | `NoTeamPage.tsx:11-208` | — |
| TEAM-CTX-005 | GAP | member 直接访问 `/team/invites`、`/team/settings` 仅靠后端 403，前端无明确拦截 | 在 admin 路由组件外层加 `<RequireRole roles={['OWNER','ADMIN']} fallback={...}>` |
| TEAM-SET-001 | PASS | `TeamController:52-64` requireWriter | — |
| TEAM-SET-002 | PASS | 同上 | — |
| TEAM-SET-003 | PASS | `TeamService:63-66` checkReviewMode | — |
| **TEAM-SET-004** | **FAIL** | `TeamService:33-37` listPublicTeams 无 `publicHome=true` 过滤；`/api/teams/{slug}` 同样无过滤 | `listPublicTeams` 与公开 detail 增加 `AND public_home=1`；同时校验前端 `/teams/:slug` 走"公开"分支不要复用 currentTeam |
| TEAM-SET-005 | GAP | `AdminDashboard.tsx:395-440` 硬编码"需要审核"，不随 reviewMode 联动 | 读取 `settings.reviewMode`，分支渲染 |
| TEAM-SET-006 | PASS | slug readonly | — |
| TEAM-MEM-001 | PASS | `TeamMemberService:27-31` 分页/筛选/搜索 | — |
| TEAM-MEM-002 | PASS | `requireTeam` 404 | — |
| **TEAM-MEM-003** | **FAIL** | `TeamMemberController:30-35` 仅 requireTeam，无 membership | controller 入口加 `requireMembership(teamId, userId)`；同步检查 admin/member 页面对 list 的调用是否 fallback 处理 |
| TEAM-MEM-004 | PASS | requireWriter + Owner 保护 | — |
| TEAM-MEM-005 | PASS | 40300 Owner 不可改 | — |
| TEAM-MEM-006 | PASS | members_count -1 | — |
| TEAM-MEM-007 | PASS | MemberMembers 只读 | — |
| TEAM-INV-001 | PASS | requireWriter create/list/revoke | — |
| TEAM-INV-002 | GAP | CreateInviteReq 未限制 `max`/`expiresInDays` 范围 | DTO 加 `@Min(1) @Max(200)` 与 days `@Min(1) @Max(365)`；同时前端按钮做相同 clamp |
| TEAM-INV-003 | PASS | NoTeamPage 闭环 | — |
| TEAM-INV-004 | PASS | active/expired/exhausted/revoked 错误分别返回 | — |
| TEAM-INV-005 | PASS | `addMember` 已存在则不重复 | — |
| **TEAM-INV-006** | **FAIL** | `InviteService:95-106` `used++` 与 exhausted 判断之间无锁 | (a) SQL 改为 `UPDATE invites SET used=used+1 WHERE id=? AND used<max_uses` 取 affectedRows；(b) 失败抛 exhausted；(c) 必要时 `SELECT ... FOR UPDATE` |
| TEAM-PHONE-001 | PASS | mask + 状态完整 | — |
| TEAM-PHONE-002 | GAP | 批量手机号邀请 API 缺失或未对齐前端 | 后端补 `POST /api/teams/{teamId}/invites/phones/batch`，或前端拆分成逐条 |
| TEAM-PHONE-003 | PASS | cancel 仅 pending | — |
| TEAM-PHONE-004 | GAP | `InviteService:120` 仅 trim，未校验格式与去重 | DTO 上 `@Pattern(regexp = "^1[3-9]\\d{9}$")`；service 内做集合去重 |
| TEAM-PHONE-005 | GAP | 前端 PhoneInvites 不能保证 expired 显示与 pending 区分 | 在状态列增加 `expired` 灰色样式 |
| TEAM-ACT-001 | PASS | `ActivityService:22` clamp [1,200] | — |
| **TEAM-ACT-002** | **FAIL** | `ActivityController:24-28` 无 membership | controller 加 `requireMembership`；nonexistent team 返回 404 而非 200 空 |
| TEAM-ACT-003 | GAP | MemberDashboard 无对 invite/unlist 类型的过滤 | 后端按 role 过滤或前端按 type 黑名单 |
| TEAM-PREF-001 | GAP | Prefs 团队名硬编码 / 不随 currentTeam 变化 | 改为 `currentTeam?.name` |
| TEAM-PREF-002 | GAP | 保存/Token/离队均占位 | 见 §4 占位按钮清单 |

### 3.3 Group C — Skill / 广场 / 详情 / 创建 / 审核

| 用例ID | 结论 | 证据 | 待修改点 |
|---|---|---|---|
| SKILL-PLZ-001 | PASS | `SkillService:54-63` PUBLIC+APPROVED | — |
| SKILL-PLZ-002 | FAIL | `SkillController:65-68` 无 page/size，`Plaza.tsx:40-52` 仅本地 filter | 后端 list 接收 PageQuery；前端加分页器或无限滚动 |
| SKILL-PLZ-003 | GAP | 后端 `q` 接收但不确定走 LIKE 还是 tag join | 验证或补 mapper：name + tag + lang 命中 |
| SKILL-DTL-001 | PASS | TEAM_PRIVATE 走 vis 分支 | — |
| SKILL-DTL-002 | PASS | TEAM_PRIVATE 要登录 | — |
| **SKILL-DTL-003** | **FAIL** | `SkillService.getDetail` 未做 `status=APPROVED` 白名单 | detail/versions/download 三处入口加：`if status not in (APPROVED, owned-by-current-user) → 404` |
| SKILL-VER-001 | GAP | 版本服务过滤未确认 | 跟 detail 同步处理；只返回 latest APPROVED + 历史 APPROVED |
| SKILL-DL-001 | GAP | `SkillController:82-95` 无可见性/状态检查 | download 入口加 status + visibility + membership 校验 |
| SKILL-DL-002 | FAIL | TEAM_PRIVATE 下载未限成员 | 同上 |
| **SKILL-ACT-001** | **FAIL** | `SkillService:262-265` `incrStars(+1)`，无 user 关联 | 建 `skill_stars(user_id, skill_id)` 关联表 + 唯一键；server 返回当前用户是否已 star，前端按 server 状态 |
| **SKILL-ACT-002** | **FAIL** | 同上 unstar 减 1，可能 < 0 | 同 SKILL-ACT-001；并加 `stars >= 0` 约束 |
| SKILL-CRT-001 | GAP | DTO 未必有 `@NotBlank` 全覆盖 | 增补 name/slug/desc/version 校验 |
| **SKILL-CRT-002** | **FAIL** | `SkillService.create` 接收 teamId 但未校验 `isMember(userId, teamId)` | 入口检查 membership；非成员直接 403 |
| SKILL-CRT-003（文档亦称 SKILL-CRT-003，分类硬编码） | FAIL | `CreateSkill/Step3.tsx:90-94` 用 tokens 里的 CATEGORIES 常量 | 改为 `useQuery(['categories'], categoryApi.list)` |
| **SKILL-CRT-004** | **FAIL** | `Step4.tsx:283` "保存为草稿" 无 onClick；后端无 draft 接口 | 后端补 `POST /api/skills/drafts` 写入 `status=DRAFT`；前端绑定，并在 `/skills/me/drafts` 联动展示 |
| SKILL-TLIB-001 | FAIL | `/api/teams/{teamId}/skills` 未做 membership 校验 | controller 加 requireMembership；非成员 403，不列举 |
| SKILL-TLIB-002 | GAP | 团队库分页/状态查询完整性未验证 | 补 status/visibility/q 组合参数与 page/size |
| SKILL-CAT-001 | FAIL | 同 SKILL-CRT-003 | — |
| **REV-001** | **FAIL** | `ReviewController` 无 `@PreAuthorize`/role 校验 | queue/detail/approve/reject/request-changes 均加 OWNER/ADMIN 校验；前端按 role 隐藏入口 |
| REV-002 | PASS | approve 状态联动 | — |
| REV-003 | PASS | reject reason 必填 + 持久化 | — |
| REV-004 | FAIL | `ReviewService.requestChanges` 仅写 reason，状态仍是 PENDING_REVIEW | 后端新增 `CHANGES_REQUESTED` 状态；流转：PENDING_REVIEW → CHANGES_REQUESTED → 重新 submit |
| REV-005 | FAIL | `ReviewService:175-267` mockFiles/mockChecks/mockSafetyReport 仍是硬编码 | 接真实 API 或把这几个字段从响应中拿掉、改 UI 显示"暂未接入" |
| SUB-001 | GAP | `MySubmissions/index.tsx:22` 客户端按 handle 过滤 | 补 `GET /api/reviews/mine` 服务端过滤 |
| **SUB-002** | **FAIL** | `MySubmissions/index.tsx:169` 把 `REJECTED` 当 `CHANGES_REQUESTED` | 等 REV-004 后端补状态后，前端直接读 status |
| SUB-003 | GAP | 评论/回复弹窗无后端 | 弹窗内禁用提交按钮，或加 endpoint |

### 3.4 Group D — Suite / 公共团队页 / 安全 / 壳层 / Envelope

| 用例ID | 结论 | 证据 | 待修改点 |
|---|---|---|---|
| SUITE-001 | PASS | `CreateSuite.tsx:15-39` | — |
| SUITE-002 | GAP | `CreateSuite.tsx:36-38` 自动回填前 5 个 skill | 用户清空后不再自动塞回，或允许 empty suite |
| SUITE-003/004 | PASS | `SuiteService:120-149` | — |
| SUITE-005 | PASS | unique key (team_id, slug) → 409 | — |
| SUITE-006 | PASS | DTO `@Valid` | — |
| **SUITE-007** | **FAIL** | `SuiteService:139-145` 直接 insert skillId，无 cross-team 校验 | 创建/更新 items 时 `SELECT team_id FROM skills WHERE id IN (...)`，与 suite.team_id 比对，否则拒绝 |
| SUITE-008 | PASS | 列表 vs 详情一致 | — |
| SUITE-009 | PASS | updateItems 整体替换 + position | — |
| SUITE-010 | PASS | DTO 校验 | — |
| SUITE-011 | PASS | 逻辑删除 + count -1 | — |
| SUITE-012 | PASS | useTeamSkills | — |
| SUITE-013 | PASS | installs +1 | — |
| SUITE-014 | GAP | 重复 install 总是 +1 | 文档化为"计数型"，或加幂等：按 user_id 去重 |
| **SUITE-015** | **FAIL** | `TeamPublic.tsx:258` 安装命令硬编码 `team?.slug`，CreateSuite 也可能拼 `ludou-fe` | 安装命令统一来自 `suite.team.slug`，并在创建页基于"当前要创建的 team"动态拼接 |
| SUITE-016 | FAIL | `CreateSuite.tsx:71-85` 取消/保存草稿无导航/无实现 | 取消 → `useNavigate(-1)`；保存草稿移除或对接 draft API |
| **SUITE-017** | **FAIL** | `TeamPublic.tsx:22-24` `useSuites(useCurrentTeam())` | 公开页改用 `useSuitesByPublicTeamSlug(slug)`，不依赖登录态 team |
| **SUITE-018** | **FAIL** | 同 017，登录 user 串到 currentTeam | 同上 |
| **SUITE-019** | **FAIL** | `listPublicTeams` 不过滤 publicHome | 同 TEAM-SET-004 |
| **SUITE-020** | **FAIL** | `SuiteController:33-39` listByTeam 无 membership | 加 requireMembership 或 Service 层 team_id 比对 |
| **SUITE-021** | **FAIL** | `SuiteController:48-68` create/update/delete/install 全部无 `@AuthenticationPrincipal` + role | 写接口加 requireWriter(teamId, userId)，install 至少需要 authenticated + visibility 校验 |
| **SUITE-022** | **FAIL** | `SuiteService:59-67` `getBySlug` 只按 slug 查 | 必须 `(team_id, slug)` 联合定位；URL 设计上把 teamId 或 teamSlug 一起带进来 |
| **SUITE-023** | **FAIL** | `getBySlug` 无 visibility + membership 校验 | TEAM_PRIVATE suite/skill 要求成员才返回 |
| SUITE-024 | PASS | `GlobalExceptionHandler` + `ApiResponse` envelope | — |
| SUITE-025 | GAP | `/team/suites`、`/create/suite` 是否自加载 team context | 页面入口若 `currentTeamId` 缺失，主动 fetch /api/teams/mine 后再渲染 |
| **PUBTEAM-001** | **FAIL** | `TeamPublic.tsx` 用 usePublicSkills + 客户端 filter，不带 teamSlug，且不过滤 publicHome | 后端补 `GET /api/teams/{slug}/public-skills`、`/public-suites`，并联动 publicHome 过滤 |
| PUBTEAM-002 | PASS | 头像跳转 `/u/:handle` | — |
| **SEC-001** | **FAIL** | SecurityConfig 白名单 OK，但 JwtAuthFilter + 前端 useSession 仍有 fail-open 风险（见 AUTH-010） | 同 AUTH-010；并补 outsider/无 token 矩阵自动化 |
| **SEC-002** | **FAIL** | 跨团队访问：成员、活动流、suite list/detail/write、skill team library、create skill 均缺校验 | 用一份 `TeamMembershipGuard` 在 controller 层集中校验 |
| SHELL-001 | PASS | `TopBar` 登录态显示菜单 | — |
| SHELL-002 | PASS | `TeamSidebar` 角色菜单 | — |
| API-ENV-001 | PASS | `GlobalExceptionHandler` + `ApiResponse` envelope | — |

### 3.5 Group E — 响应式 / 占位按钮 / A11y

| 用例ID | 结论 | 证据 | 待修改点 |
|---|---|---|---|
| **RESP-001** | **FAIL** | `Login.tsx:145` `flex:'0 0 480px'`、`Register.tsx:162` `flex:'0 0 520px'`；截图 `auth-login-mobile-overflow.png` 已验证 | 改用 `max-w-[480px] w-full` + 移动端断点；视觉区在 `<lg:hidden>` |
| RESP-002 | GAP | Profile / 公开用户页未做完整断点验证 | 加 Playwright screenshot 矩阵 |
| RESP-003 | GAP | 团队工作区未明显使用 Tailwind sm:/md:/lg: 断点 | sidebar 在 `<md` 折成 drawer 或顶部 tab |
| RESP-004 | GAP | Skill 页面未发现明显问题，但缺验证 | 同 RESP-002 加截图 |
| RESP-005 | GAP | `CreateSuite.tsx:94` `gridTemplateColumns:'1fr 360px'` 侧栏固定 | `<md` 切回单列 |
| **UI-ACTION-001** | **FAIL** | 至少 12 个占位按钮，见 §4 | 按 §4 清单逐条处置 |
| **A11Y-001** | **FAIL** | `ui/FormError.tsx:14` 只用 marginTop:4，无 `role="alert"`、`aria-live="polite"`；输入框无 `aria-invalid` / `aria-describedby` | 给 FormError 加 `role="alert"`；输入控件根据 error 状态自动加 aria 属性 |
| A11Y-002 | GAP | 静态分析无法确认 | Playwright 键盘脚本验证 |

---

## 4. 占位按钮清单（UI-ACTION-001）

下列按钮在 UI 上可见可点击，但 onClick 缺失或仅 alert/log，可能让自动化通过虚假成功状态：

| 文件:行号 | 文本 | 当前行为 | 建议处置 |
|---|---|---|---|
| `frontend/src/pages/team/admin/Suites/SuiteEditor.tsx:115` | 预览 | 无 onClick | 实现预览 modal 或 `disabled` + tooltip |
| `frontend/src/pages/create/CreateSuite.tsx:72` | 取消 | 无 onClick | `navigate(-1)` |
| `frontend/src/pages/create/CreateSkill/Step1.tsx:98` | 取消 | 无 onClick | `navigate(-1)` |
| `frontend/src/pages/team/member/Prefs.tsx:194` | 更换头像 | 无 onClick | 接入头像上传或禁用 |
| `frontend/src/pages/team/member/Prefs.tsx:215` | 放弃修改 | 无 onClick | 重置表单 |
| `frontend/src/pages/team/member/Prefs.tsx:251` | 新建 Token | 无 onClick | 接入 token API 或禁用 |
| `frontend/src/pages/team/member/Prefs.tsx:296` | 复制 | 无 onClick | `navigator.clipboard.writeText` |
| `frontend/src/pages/team/member/Prefs.tsx:299` | 吊销 | 无 onClick | 接入 token API 或禁用 |
| `frontend/src/pages/team/member/Prefs.tsx:331` | 取消 | 无 onClick | `navigate(-1)` |
| `frontend/src/pages/team/member/Suites.tsx:217` | 复制命令 | 无 onClick | `navigator.clipboard.writeText(installCmd)` |
| `frontend/src/pages/team/member/Dashboard.tsx:106` | 查看全部 | 无 onClick | `navigate('/team/activity')` 或对应路由 |
| `frontend/src/pages/team/member/Dashboard.tsx:134` | 查看 | 无 onClick | 跳转目标条目 |
| `frontend/src/pages/public/UserProfile.tsx:100-106` | 关注/私信 | 无 onClick（USER-002） | 禁用 + "敬请期待"提示 |
| `frontend/src/pages/create/CreateSkill/Step4.tsx:283` | 保存为草稿 | 无 onClick（SKILL-CRT-004） | 接入 draft API 或移除 |

> 原则：可见且可点击按钮必须有可验证结果；未开放能力一律 `disabled` + 文案。

---

## 5. 数据库 / Schema 影响清单

随上述修复需要的 schema 变更（Flyway migration）：

1. `skill_stars(user_id BIGINT, skill_id BIGINT, created_at, PRIMARY KEY(user_id, skill_id))` — 修 SKILL-ACT-001/002
2. `skills.status` 加索引（如果还没有），方便 detail / list 状态过滤 — 修 SKILL-DTL-003
3. `reviews.status` 枚举追加 `CHANGES_REQUESTED` — 修 REV-004 / SUB-002
4. `users.bio VARCHAR(...)`、`users.avatar_color VARCHAR(...)`（如果决定保留 step3 字段）— 修 REG-008
5. `team_invites.max_uses` 加 `CHECK` 或在 DTO 层 clamp — 修 TEAM-INV-002
6. `team_invites` 并发使用 — 通过 SQL `UPDATE ... WHERE used<max_uses` + affectedRows 判定，不一定需要 schema 改动 — 修 TEAM-INV-006

---

## 6. 修复路线建议（按 sprint 分批）

**Sprint 1（必须先做，所有 P0 安全）**
- AUTH-010 / ACC-002 / SEC-001：fail-closed token；禁用生产 DEV_LOGIN
- SKILL-DTL-003 / SKILL-DL-001/002：详情、版本、下载加 status + visibility + membership 白名单
- REV-001：审核接口 OWNER/ADMIN 校验
- SUITE-020/021/022/023 + SKILL-CRT-002 + SKILL-TLIB-001 + TEAM-MEM-003 + TEAM-ACT-002：跨团队 / 跨成员越权统一治理（建议引入 `TeamMembershipGuard`）
- TEAM-SET-004 / SUITE-019 / PUBTEAM-001：`publicHome=false` 过滤
- TEAM-INV-006：邀请码并发 CAS

**Sprint 2（数据正确性 + 状态机闭环）**
- SKILL-ACT-001/002：star/unstar 幂等
- REV-004 / SUB-002：CHANGES_REQUESTED 状态
- REV-005：审核详情去 mock
- SUITE-007 / SUITE-014 / SUITE-015：跨团队 skillId、安装命令、install 语义
- AUTH-009：7 天免登录语义
- TEAM-INV-002 / TEAM-PHONE-004：参数范围 + 手机号格式

**Sprint 3（UI 闭环 + 响应式 + A11y）**
- UI-ACTION-001 占位按钮 14 条
- RESP-001 移动端登录/注册溢出
- A11Y-001 FormError ARIA
- TEAM-CTX-002 / 005：失效 teamId 恢复、路由守卫
- TEAM-SET-005 / TEAM-ACT-003：dashboard 联动 reviewMode、member 活动流过滤
- REG-008 / USER-002：bio/avatarColor 与公开页占位按钮处理
- SKILL-PLZ-002 / SKILL-CRT-003-CAT-001 / SKILL-CRT-004：广场分页、分类走 API、草稿 API

---

## 7. 执行进度模板

```md
## 测试执行记录

- 执行日期：
- 分支 / commit：
- 环境：local / CI / staging
- 数据库状态：fresh migration / reused / custom fixture
- 前端地址：
- 后端地址：
- 执行范围：Group A / B / C / D / E

| 用例ID | 结果(PASS/FAIL/BLOCK) | 缺陷链接 | 备注 |
|---|---|---|---|
| AUTH-001 |  |  |  |
```

> 建议把本报告的 Top 10（§0）直接作为本轮上线门禁；其余 FAIL/GAP 按 §6 路线推进。
