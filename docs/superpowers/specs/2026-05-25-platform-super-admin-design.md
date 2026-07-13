# 平台超级管理员（Super Admin）设计

- 状态：Draft
- 日期：2026-05-25
- 范围：后端、数据库、前端、CLI 不变

## 1. 背景与目标

当前 SkillStack 只有 **团队级别** 角色（`OWNER / ADMIN / MEMBER / VIEWER`），缺少一个真正的"平台所有者"视角：

- 无人能跨团队查看所有用户、所有团队、所有 skill / suite。
- 站点品牌（名称、Logo、版权信息）写死在前端 / token，无法运行时调整。
- 出现违规内容时没有强制下架通路；出现可疑账号时没有禁用通路。

本设计引入 **平台级 SUPER_ADMIN 角色** 和 **/admin 控制台**，覆盖：

1. 系统设置：站点名称、副标题、品牌 Logo、Footer / 版权文案。
2. 跨团队的用户、团队、skill、suite 只读 + 必要管控操作。
3. 审计：所有破坏性操作留痕。

非目标（明确不做）：

- 多种平台角色（审计员、客服、…）；当前只有 `USER / SUPER_ADMIN` 两态。
- 主题 / 配色自定义、登录方式开关、备案号等更多设置项（K/V 表预留扩展）。
- 跨团队成员调动、团队合并、数据导出等高级运维操作。
- Favicon 单独上传（v1 暂复用 Logo）。
- 公共广场推荐 / 内容编辑能力。

## 2. 角色与权限模型

### 2.1 平台角色

- 在 `users` 表新增 `platform_role ENUM('USER','SUPER_ADMIN') DEFAULT 'USER'`。
- 不影响任何团队角色（team_members.role 保持不变）。
- 超级管理员 **与具体团队解耦**：可以不属于任何团队也能进入 `/admin`。

### 2.2 用户禁用

- `users.status ENUM('ACTIVE','DISABLED') DEFAULT 'ACTIVE'`。
- `DISABLED` 用户：登录被拒绝；已签发的 JWT 在校验时拒绝；所有写操作返回 403。
- 仅 `SUPER_ADMIN` 可切换。

### 2.3 团队禁用

- `teams.status ENUM('ACTIVE','DISABLED') DEFAULT 'ACTIVE'`。
- `DISABLED` 团队：成员仍能登录，但无法创建 / 编辑 / 发布 skill / 套件；公开广场不展示其 skill。
- 仅 `SUPER_ADMIN` 可切换。

### 2.4 拦截方式

- 新增注解 `@RequireSuperAdmin`（运行时 + AOP 切面），不满足抛 `BusinessException("FORBIDDEN", "需要超级管理员权限")`。
- `SecurityConfig` 在已有 JWT 过滤链之外，对 `/api/admin/**` 显式要求登录；细粒度由 `@RequireSuperAdmin` 把关。
- `/api/site/branding` 加入既有公开白名单。
- 登录态 `me` payload 增加 `platformRole` 字段，前端据此控制入口可见性。

### 2.5 Bootstrap 与最少超管约束

- Flyway migration **新增一个 `handle='root'` 的超管账号**作为首个超管：
  - `handle = 'root'`，`name = 'Root Admin'`，`email = 'root@skillstack.local'`
  - `platform_role = 'SUPER_ADMIN'`、`status = 'ACTIVE'`
  - 初始密码 **`admin123`**（bcrypt 散列：`$2a$10$/kqzSwe8d.F8o8oSDmUw9OI3plvLXZSU9xPmCpNOvpOdFerWxsVPS`）
  - 不属于任何团队，仅用于平台管理
  - 启动后强烈建议立即在 `/account` 修改密码（README / 后台 Dashboard 提示）
- 现有 seed 用户（`lin_zr` 等 id 1–8）**不会**被自动提升；它们是产品演示账号。
- 后续超管由现有超管在 UI 中互相提升。
- **不允许把"最后一个 ACTIVE 的 SUPER_ADMIN"降级或禁用**；Service 层显式校验，错误码 `LAST_SUPER_ADMIN`。
- bcrypt 散列由 `BCryptPasswordEncoder().encode("admin123")` 生成；migration 内嵌使用，便于实施时核对。如需重新生成，可在仓库根目录运行该命令重算（任意合法 bcrypt 散列均可，因为每次生成不同 salt）。

## 3. 数据库变更

新增 Flyway migration `V23__platform_super_admin.sql`：

```sql
-- 平台角色 + 用户状态
ALTER TABLE users
  ADD COLUMN platform_role ENUM('USER','SUPER_ADMIN') NOT NULL DEFAULT 'USER' AFTER feishu_avatar_url,
  ADD COLUMN status        ENUM('ACTIVE','DISABLED')  NOT NULL DEFAULT 'ACTIVE' AFTER platform_role;

CREATE INDEX idx_users_platform_role ON users(platform_role);
CREATE INDEX idx_users_status        ON users(status);

-- 团队状态
ALTER TABLE teams
  ADD COLUMN status ENUM('ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX idx_teams_status ON teams(status);

-- 站点设置 K/V 单例
CREATE TABLE site_settings (
  setting_key   VARCHAR(64)  NOT NULL PRIMARY KEY,
  setting_value TEXT         NULL,
  value_type    ENUM('STRING','URL','BOOL','JSON') NOT NULL DEFAULT 'STRING',
  updated_by    BIGINT       NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO site_settings(setting_key, setting_value, value_type) VALUES
  ('site.name',     'SkillStack', 'STRING'),
  ('site.tagline',  '',           'STRING'),
  ('site.logo_url', '',           'URL'),
  ('site.footer',   '',           'STRING');

-- 审计日志
CREATE TABLE admin_audit_log (
  id           BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id     BIGINT       NOT NULL,
  action       VARCHAR(64)  NOT NULL,
  target_type  VARCHAR(32)  NOT NULL,
  target_id    BIGINT       NULL,
  payload_json JSON         NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_admin_audit_actor (actor_id, created_at),
  KEY idx_admin_audit_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- bootstrap：插入 root 超管账号
-- 密码：admin123（首次登录后请立即修改）
-- bcrypt 散列由 Spring BCryptPasswordEncoder.encode("admin123") 生成
INSERT INTO users (
  handle, name, email, avatar, password_hash,
  platform_role, status, joined_at, created_at, updated_at, deleted
) VALUES (
  'root',
  'Root Admin',
  'root@skillstack.local',
  'R',
  '$2a$10$/kqzSwe8d.F8o8oSDmUw9OI3plvLXZSU9xPmCpNOvpOdFerWxsVPS',
  'SUPER_ADMIN',
  'ACTIVE',
  NOW(),
  NOW(),
  NOW(),
  0
);
```

> bcrypt 散列具有非确定性，每次 `encode("admin123")` 产生不同 salt 但都能匹配。
> 如果实施时希望重新生成，运行：
> ```bash
> # 在 backend/ 目录下
> mvn -q exec:java -Dexec.mainClass=... # 或临时 main 调用 BCryptPasswordEncoder
> ```
> 替换 migration 中的散列字符串即可。

迁移幂等性：所有 `ADD COLUMN` / `CREATE TABLE` 通过 Flyway 一次性应用；不需要回填脚本（默认值已就绪）。

## 4. 后端模块结构

新增 `backend/src/main/java/com/skillstack/admin/`，与 `auth / team / skill / suite` 同级：

```
admin/
  controller/
    AdminSettingsController.java   # /api/admin/settings, /api/site/branding
    AdminUserController.java       # /api/admin/users/**
    AdminTeamController.java       # /api/admin/teams/**
    AdminSkillController.java      # /api/admin/skills/**
    AdminSuiteController.java      # /api/admin/suites/**
  service/
    SiteSettingsService.java
    AdminUserService.java
    AdminTeamService.java
    AdminSkillService.java
    AdminSuiteService.java
    AuditLogService.java
  entity/
    SiteSetting.java
    AdminAuditLog.java
  mapper/
    SiteSettingMapper.java
    AdminUserMapper.java        # 仅供 admin 视角的跨团队查询
    AdminTeamMapper.java
    AdminSkillMapper.java
    AdminSuiteMapper.java
    AdminAuditLogMapper.java
  dto/
    BrandingVO.java
    SiteSettingVO.java
    UpdateSettingsReq.java
    AdminUserListItemVO.java
    AdminUserDetailVO.java
    AdminTeamListItemVO.java
    AdminTeamDetailVO.java
    AdminSkillListItemVO.java
    AdminSuiteListItemVO.java
  security/
    RequireSuperAdmin.java       # 注解
    SuperAdminAspect.java        # AOP 切面
```

共享 / 跨模块约定：

- 现有 `auth.User` 实体扩展 `platformRole`、`status` 字段。
- 现有 `team.Team` 实体扩展 `status` 字段。
- 现有 `UserService` 的"按用户查询"在 admin 视角下复用，但跨团队聚合走新 mapper，避免污染团队作用域查询。

## 5. 后端 API

所有 admin 路径要求 JWT + `@RequireSuperAdmin`。返回统一 `ApiResponse<T>`。列表返回 `PageResult<T>`。破坏性操作写 `admin_audit_log`。

### 5.1 站点品牌（公开 + 管理）

| Method | Path | 说明 |
|---|---|---|
| GET  | `/api/site/branding`         | 公开。返回 `{ name, tagline, logoUrl, footer }`，前端启动时读取并缓存 |
| GET  | `/api/admin/settings`        | 列出全部 setting K/V，含 `updatedBy / updatedAt` |
| PUT  | `/api/admin/settings`        | 批量更新；body 形如 `{ "site.name": "..." }`，按 key 白名单校验 |
| POST | `/api/admin/settings/logo`   | `multipart/form-data` 上传 logo，复用现有 file storage；返回新 URL 并写入 `site.logo_url` |

设置 key 白名单（v1）：`site.name`、`site.tagline`、`site.logo_url`、`site.footer`。
任何不在白名单的 key 在 PUT 时被忽略并在响应中标记 `unknownKeys`。

### 5.2 用户管理

| Method | Path | 说明 |
|---|---|---|
| GET  | `/api/admin/users`                       | 分页：`q, platformRole, status, page, size`；返回 handle/name/email/phone/平台角色/状态/所属团队数 |
| GET  | `/api/admin/users/{id}`                  | 详情：基本信息 + 所属团队列表 + 最近登录 |
| POST | `/api/admin/users/{id}/disable`          | 禁用；记录审计 |
| POST | `/api/admin/users/{id}/enable`           | 启用；记录审计 |
| POST | `/api/admin/users/{id}/reset-password`   | 生成一次性临时密码，仅在响应体中返回一次 |
| POST | `/api/admin/users/{id}/promote`          | platform_role → SUPER_ADMIN |
| POST | `/api/admin/users/{id}/demote`          | SUPER_ADMIN → USER；若是最后一个 ACTIVE 超管则拒绝（`LAST_SUPER_ADMIN`） |

约束：

- 禁止超管 disable / demote 自己 → 错误码 `SELF_OPERATION_FORBIDDEN`。
- 禁用最后一个 ACTIVE 超管 → 错误码 `LAST_SUPER_ADMIN`。

### 5.3 团队管理

| Method | Path | 说明 |
|---|---|---|
| GET  | `/api/admin/teams`                  | 分页：`q, status, page, size`；返回名称/owner/成员数/skill 数/状态 |
| GET  | `/api/admin/teams/{id}`             | 详情：成员摘要、skill 摘要、套件摘要 |
| POST | `/api/admin/teams/{id}/disable`     | 禁用 |
| POST | `/api/admin/teams/{id}/enable`      | 启用 |

禁用后行为：

- 成员仍可登录、可读自身资料；
- 团队内 skill / suite 写操作被拒（已有 Service 层增加 `assertTeamActive(teamId)`）；
- 公开广场过滤 `team.status = DISABLED` 的内容。

### 5.4 Skill 跨团队管理

| Method | Path | 说明 |
|---|---|---|
| GET  | `/api/admin/skills`                    | 分页：`q, teamId, status, visibility, page, size`；返回基本字段 + 所属团队 |
| POST | `/api/admin/skills/{id}/unpublish`     | 强制下架：`status → ARCHIVED`，`visibility → PRIVATE`，记录审计 |

### 5.5 套件跨团队管理

| Method | Path | 说明 |
|---|---|---|
| GET  | `/api/admin/suites`                    | 分页：`q, teamId, page, size` |
| POST | `/api/admin/suites/{id}/unpublish`     | 强制下架，记录审计 |

### 5.6 错误码

新增 / 复用：

- `FORBIDDEN` — 非超管访问 `/api/admin/**`。
- `LAST_SUPER_ADMIN` — 试图降级 / 禁用最后一个超管。
- `SELF_OPERATION_FORBIDDEN` — 超管自禁 / 自降。
- `SETTING_KEY_INVALID` — 设置 key 不在白名单。
- `SETTING_VALUE_INVALID` — value 类型与 `value_type` 不符（如 URL 不合法）。

## 6. 前端结构

### 6.1 路由与入口

- 新增 `frontend/src/pages/admin/`：

```
admin/
  _shared/                # 复用 team/admin/_shared 的 Section / Toolbar 等基础组件，或抽到 components/admin 复用
  AdminLayout.tsx         # 左侧导航：Overview / Settings / Users / Teams / Skills / Suites
  Dashboard.tsx           # 概览：总用户数、总团队数、总 skill 数、最近审计
  Settings.tsx            # 站点名称 / 副标题 / Logo 上传 / Footer 编辑
  Users.tsx
  Teams.tsx
  Skills.tsx
  Suites.tsx
```

- `frontend/src/router.tsx` 增加 `/admin/*` 子树，外层包 `RequireSuperAdmin` guard。
- `TopBar` 在用户菜单中加入 "平台管理" 入口，仅 `me.platformRole === 'SUPER_ADMIN'` 时显示。
- 普通用户直接访问 `/admin/**` → 重定向回 `/team`。

### 6.2 全局品牌

- 新增 `frontend/src/store/branding.ts`（Zustand）：`{ name, tagline, logoUrl, footer, loaded }`。
- `App.tsx` 启动时调用 `GET /api/site/branding`，写入 store；失败时回退到内置默认值（不阻塞渲染）。
- `TopBar`、登录页、Footer 组件从 store 读取，移除当前硬编码字符串 `"SkillStack"`。
- Settings 页保存成功后立即用响应体更新 store，无需刷新。

### 6.3 API 层

`frontend/src/api/endpoints.ts` 增加 `admin` namespace；`frontend/src/api/admin.ts` 新增 hook：

- `useSiteBranding()` / `useUpdateSiteSettings()` / `useUploadLogo()`
- `useAdminUsers(query)` / `useAdminUserDetail(id)` / `useDisableUser` / `useEnableUser` / `useResetUserPassword` / `usePromoteUser` / `useDemoteUser`
- `useAdminTeams(query)` / `useAdminTeamDetail(id)` / `useDisableTeam` / `useEnableTeam`
- `useAdminSkills(query)` / `useUnpublishSkill`
- `useAdminSuites(query)` / `useUnpublishSuite`

所有 mutation 成功后通过 TanStack Query invalidate 对应 list 缓存。

### 6.4 UI 约定

- 复用 `frontend/src/lib/tokens.ts` 中的语义色，不引入新品牌色；危险操作（禁用 / 下架 / 重置密码）走 `danger` 语义。
- 表格使用现有 `team/admin` 用到的 Table / Toolbar 模式，保持视觉一致。
- 所有破坏性操作弹出二次确认 Dialog，并明确说明影响（"该团队成员将无法发布 skill"）。
- Logo 上传组件复用现有团队 Logo 组件，并加入预览与"恢复默认"按钮。

## 7. 审计日志

- 写时机：所有 admin 路径的 POST 操作（disable / enable / promote / demote / reset-password / unpublish / settings 更新 / logo 上传）。
- 字段：`actor_id` 来自 `CurrentUser`，`payload_json` 仅存可逆向的关键字段（用户 id / team id / 旧值 → 新值），**绝不存密码 / token / 文件二进制**。
- v1 不暴露查看界面；通过 SQL / 后续 Dashboard 查阅即可（Dashboard 显示"最近 N 条审计"作为列表占位即可）。

## 8. 验证策略

后端：

- `mvn test`：
  - `AdminUserServiceTest`：禁用 / 启用 / 提升 / 降级 / 最后一个超管 / 自禁 守卫。
  - `SiteSettingsServiceTest`：白名单过滤、未知 key 处理、value_type 校验。
  - `AdminSecurityTest`：非超管访问 `/api/admin/**` 返回 403；公开 `/api/site/branding` 不需登录。
  - `AdminSkillServiceTest`：unpublish 后 skill `status=ARCHIVED, visibility=PRIVATE`，且公开广场过滤。
- 编译验证：`mvn -q -DskipTests compile`。

前端：

- `npm run lint` 类型检查通过。
- `npm run build` 通过。
- 浏览器 smoke：以 `root / admin123` 登录 → 顶栏出现"平台管理"入口 → `/admin/settings` 修改 name 与 footer，刷新生效 → `/admin/users` 列表分页 → 提升一个用户为超管，登出再登该用户能看到入口 → `/admin/teams` 禁用一个团队，被禁团队成员发布 skill 收到 403。

## 9. 分阶段实施建议

1. **DB & 后端权限脚手架**：migration + `RequireSuperAdmin` + 公共错误码 + `me.platformRole` 输出。
2. **站点设置后端 + branding 公开接口 + 前端 Zustand store + Settings 页**（先打通"站点名能改"，价值最直观）。
3. **用户管理后端 + UI**。
4. **团队管理后端 + UI（含禁用副作用）**。
5. **Skill / Suite 下架后端 + UI**。
6. **审计日志写入 & Dashboard 摘要**。

各阶段独立可发布，前后端契约保持向后兼容。

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 最后一个超管被锁死 | 服务端硬规则 + 前端按钮置灰 + 错误提示 |
| 误操作下架大量 skill | 单条强制下架，无批量入口；二次确认 |
| 站点设置写脏 / 误删 logo | K/V 表保留历史 `updated_by/updated_at`；后续可扩展版本历史；Logo 上传不删旧文件 |
| 禁用团队后已发布 skill 仍在广场 | 广场查询 join `teams.status = ACTIVE` 过滤 |
| 跨团队聚合查询性能 | `users / teams / skills.status` 加索引；列表统一分页，不允许 `size > 100` |

## 11. 不影响项

- CLI（`smskill`）契约不变。
- 现有团队管理 `/team/admin/**` 路由与组件不动。
- 现有 JWT 结构兼容（仅在 `me` payload 增加字段，老前端忽略即可）。
