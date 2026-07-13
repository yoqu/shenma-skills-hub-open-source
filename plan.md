# SkillStack · 团队 Skill 平台开发计划

> 设计稿：`docs/design-ui/` — 22 屏高保真原型（公共发现 7 + Admin 工作台 7 + Member 工作台 6 + 创建流程 2）
> 技术栈：**Spring Boot 3 + MyBatis Plus + MySQL 8** / **React 18 + Vite + TS + Tailwind + shadcn/ui**

## 已确认决策
1. **目录结构**：前后端分离 — `/backend` + `/frontend`
2. **前后端节奏**：前端先用 mock，Phase 3 切真实 API → 前后端可同时并行
3. **组件库**：shadcn/ui 打底 + Tailwind 精调，按设计稿像素对齐
4. **数据库**：项目自带 `docker-compose.yml`，本地起 MySQL 8

---

## 🤖 Sub-agent 编排

```
Phase 0 (串行, 1 agent)
   │
   ├──地基完成──┐
   │           │
   ▼           ▼
Phase 1 (5 agent 并行 · 后端模块)    Phase 2 (5 agent 并行 · 前端页面)
   │                                   │
   └──────────────┬────────────────────┘
                  ▼
          Phase 3 (串行 · 联调像素核对)
```

### Phase 0 — 项目骨架 + 共享层 ⚙️
**Owner**: 主 agent / 串行
**产出**:
- `/docker-compose.yml` — MySQL 8 + 持久化卷
- `/backend/` — Spring Boot 3 Maven 项目 + MyBatis Plus + Flyway 迁移 + JWT 配置
- `/backend/src/main/resources/db/migration/V1__schema.sql` — 全部表
- `/backend/src/main/resources/db/migration/V2__seed.sql` — 设计稿 mock 数据 → MySQL
- `/frontend/` — Vite + React 18 + TS + Tailwind + shadcn/ui 骨架
- `/frontend/src/lib/tokens.ts` + `tailwind.config.ts` — 从 `docs/design-ui/tokens.css` 1:1 移植
- `/frontend/src/components/atoms/` — Avatar / Badge / Button / Card / Tag / Score / SkillIcon / SkillCard / Kbd / Stat / SectionHeader
- `/frontend/src/components/icons.tsx` — 50+ icon 移植（lucide-react 替代 + 自定义补齐）
- `/frontend/src/components/chrome/` — TopBar / TeamSidebar / Tabs
- `/frontend/src/mocks/` — 设计稿数据 → ts 模块
- `/frontend/src/router.tsx` — 22 屏路由 + 角色守卫

### Phase 1 — 后端模块（5 agent 并行）🛠️
| Agent | 包 | 主要接口 |
|---|---|---|
| BE-Auth | `com.skillstack.auth` | `POST /api/auth/login` `POST /api/auth/register/{step}` `GET /api/me` |
| BE-Team | `com.skillstack.team` | `GET /api/teams/mine` `GET /api/teams/{slug}` `GET/POST /api/teams/{id}/members` `*/invites` |
| BE-Skill | `com.skillstack.skill` | `GET /api/skills` (广场) `GET /api/skills/{slug}` `POST /api/skills` `POST /api/skills/{id}/install` |
| BE-Review | `com.skillstack.review` | `GET /api/reviews` `POST /api/reviews/{id}/approve\|reject` |
| BE-Suite | `com.skillstack.suite` + `activity` | `*/suites` `GET /api/activity` |

### Phase 2 — 前端页面（5 agent 并行）🎨
| Agent | 目录 | 屏幕（来源 jsx）|
|---|---|---|
| FE-Public | `pages/public/` | Home, Plaza, SkillDetail, TeamPublic, UserProfile |
| FE-Auth | `pages/auth/` | Login, Register (4-step wizard) |
| FE-Admin | `pages/team/admin/` | Dashboard, Skills, Reviews, Members, Invites, Suites, Settings |
| FE-Member | `pages/team/member/` | Dashboard, Skills, MySubmissions, Members(只读), Suites(浏览), Prefs |
| FE-Create | `pages/create/` | CreateSkill (4 steps), CreateSuite |

### Phase 3 — 联调与像素核对 🔬
- 前端 mock 切到真实 API（统一在 `src/api/` 切换）
- 启动 docker-compose + backend + frontend，每屏对照截图核对
- 修复 bug 与样式偏差

---

## 📊 进度看板

| # | 阶段 | 状态 | 备注 |
|---|------|------|------|
| 0 | 骨架 + 共享层 | ✅ 完成 | docker-compose · 15 张表 · 22 屏路由 · 共享原子组件 |
| 1.1 | BE-Auth | ✅ 完成 | 7 接口 · sms/login/register×4/me |
| 1.2 | BE-Team | ✅ 完成 | 25 文件 · 团队/成员/邀请码/手机邀请 |
| 1.3 | BE-Skill | ✅ 完成 | 23 文件 · 广场/详情/版本/创建/安装/收藏 |
| 1.4 | BE-Review | ✅ 完成 | queue/detail/approve/reject + 联动 skill.status |
| 1.5 | BE-Suite/Activity | ✅ 完成 | 套件 6 接口 + 活动流 1 接口 |
| 2.1 | FE-Public | ✅ 完成 | Home/Plaza/SkillDetail/TeamPublic/UserProfile · build pass |
| 2.2 | FE-Auth | ✅ 完成 | Login(3 步) + Register(4 步) · build pass |
| 2.3 | FE-Admin | ✅ 完成 | 7 屏 + AdminShell + 复杂子组件 · build pass |
| 2.4 | FE-Member | ✅ 完成 | 6 屏 + MemberShell · build pass |
| 2.5 | FE-Create | ✅ 完成 | CreateSkill(4 步) + CreateSuite · build pass |
| 3 | 联调 + UI 回归 | ✅ 完成 | MySQL(3307) + backend(8080) + frontend(5173) ✅ · Chrome 22 屏扫描 ✅ · 核心交互回归 ✅ |

图例：⏳ 进行中 / ✅ 完成 / ⛔ 阻塞 / ❌ 失败

---

## 📐 数据库 Schema 摘要

```
users         (id, handle, name, email, phone, avatar, password_hash, joined_at)
teams         (id, slug, name, desc, avatar_char, color, public_skills, private_skills, members_count, suites_count)
team_members  (team_id, user_id, role[OWNER/ADMIN/MEMBER/VIEWER], joined_at, last_active_at)
skills        (id, slug, name, short, cat, icon, version, visibility, status, author_id, team_id, installs, stars, score, safety, eval_score, langs[], tags[], updated_at)
skill_versions(skill_id, version, changelog, files_count, created_at)
suites        (id, slug, name, desc, team_id, visibility, installs, updated_at)
suite_items   (suite_id, skill_id, position)
reviews       (id, skill_id, submitter_id, status[PENDING/APPROVED/REJECTED], safety, eval_score, reason, submitted_at)
invites_code  (id, team_id, code, max_uses, used, role, expires_at, created_by, status)
invites_phone (id, team_id, phone_masked, invited_by, note, status, created_at)
activity      (id, team_id, actor_id, kind, target, extra, created_at)
categories    (id, name, count)  -- 静态
tags          (id, name)         -- 关联表
```

## 🎯 完成定义
- [x] docker-compose up 后端能连接 MySQL 启动
- [x] frontend dev server 可访问全部 22 屏
- [x] 22 屏 Chrome 功能/UI 回归通过（当前仓库未包含 `docs/design-ui/` 截图基准，无法做像素 diff）
- [x] 主要页面数据来自真实后端 API
- [x] Admin / Member 角色切换体现差异（侧栏菜单 / 权限按钮）

---

## 🔧 /team/prefs 生产化（2026-05-22）

设计：`docs/superpowers/plans/2026-05-21-team-member-prefs.md`

- [x] 我的资料：`team_member_profile` 表 + `/api/teams/{teamId}/me/profile` GET/PUT；前端去除硬编码 `陈奕笑`/`chen_yx`/`麓豆前端组`；头像走账号级 `/me/avatar`
- [x] 通知偏好：`notification_pref` 表 + `/api/teams/{teamId}/me/notification-prefs` GET/PUT；前端 optimistic update + rollback；默认值与渠道校验在 service 层
- [x] 我的 Token：`personal_access_token` 表（SHA-256 哈希 + 前缀展示）+ `/api/teams/{teamId}/me/tokens` list/create/revoke；明文仅创建时一次返回；`JwtAuthFilter` 接受 `Bearer lst_…`，仅放行 `/api/skills/*` 下载/安装/详情/版本路径，其它路径返回 403
- [x] 离开团队：`POST /api/teams/{teamId}/leave`；唯一 Owner 守卫（`40300 / T_LAST_OWNER`）；离队级联吊销该用户在本团队下的全部 PAT

延伸项（未在本期实现）：
- [ ] 站内通知中心 + 邮件投递器（把偏好转成实际投递动作）
- [ ] 团队级头像覆盖（当前仅账号级头像）
- [ ] PAT 范围管理（除 download/install 之外的更细粒度授权）
- [ ] 转让所有权 UI（让唯一 Owner 也能优雅离队）
