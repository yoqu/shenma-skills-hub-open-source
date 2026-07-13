# 多 OAuth 登录方式与后台配置设计

- 状态：Draft
- 日期：2026-05-25
- 范围：后端、数据库、前端 admin / 登录页；CLI 不变
- 关联：`docs/superpowers/specs/2026-05-25-platform-super-admin-design.md`

## 1. 背景与目标

当前 SkillStack 三方登录只支持飞书，参数通过 `application.yml` 的
`skillstack.feishu.*` + `@Value` 静态注入：

- 运维想换 `app_id / app_secret` 必须改配置 + 重启。
- 飞书之外的渠道（linux.do、未来 GitHub / Google）没有可扩展点。
- 超管后台没有任何"登录方式"管理入口。

本设计引入**统一的 OAuth Provider 模型**与对应的超管后台页面，目标：

1. 后台可视化管理任意 provider 的启用开关与参数（client_id / client_secret /
   redirect_uri / scope / 端点 URL / 显示信息）。
2. 内置支持 **飞书** 与 **linux.do** 两个 provider；后续新增 provider 仅需新增
   一个 `XxxAuthService` + 一行 seed，不再改 schema、不再改前端登录页。
3. 多个 provider 可同时启用；登录页按 enabled 列表动态渲染按钮。
4. 用户与 OAuth 身份的绑定走通用 `user_oauth_identities` 表，同一用户可绑定
   多个 provider。

非目标：

- 账户设置页的"绑定/解绑 OAuth"功能（仅首登自动绑定，v1 不做手动管理）。
- client_secret 加密存储（v1 明文，靠超管 RBAC + DB 访问控制保护；后续可在
  `oauth_providers` 上叠加 AES 列改造，schema 兼容）。
- 删除 provider 行（避免误删导致登录中断；仅支持 disable）。
- 自定义字段映射 / claims 转换（用 `extra_json` 预留，v1 不实现）。

## 2. 数据库变更

新增 Flyway migration `V25__oauth_providers.sql`：

```sql
-- 1. provider 配置表
CREATE TABLE oauth_providers (
  code           VARCHAR(32)  NOT NULL PRIMARY KEY,    -- 'feishu' / 'linux_do'
  display_name   VARCHAR(64)  NOT NULL,
  enabled        TINYINT(1)   NOT NULL DEFAULT 0,
  client_id      VARCHAR(255) NULL,
  client_secret  VARCHAR(255) NULL,                    -- v1 明文存储
  redirect_uri   VARCHAR(512) NULL,
  scope          VARCHAR(255) NULL,
  authorize_url  VARCHAR(512) NULL,
  token_url      VARCHAR(512) NULL,
  userinfo_url   VARCHAR(512) NULL,
  icon_url       VARCHAR(512) NULL,                    -- 登录按钮图标
  button_label   VARCHAR(64)  NULL,                    -- 登录按钮文案，空走 display_name
  sort_order     INT          NOT NULL DEFAULT 0,
  extra_json     JSON         NULL,                    -- 预留
  updated_by     BIGINT       NULL,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO oauth_providers
  (code, display_name, enabled, scope, authorize_url, token_url, userinfo_url, sort_order)
VALUES
  ('feishu', '飞书', 0, '',
   'https://open.feishu.cn/open-apis/authen/v1/authorize',
   'https://open.feishu.cn/open-apis/authen/v1/access_token',
   'https://open.feishu.cn/open-apis/authen/v1/user_info',
   10),
  ('linux_do', 'linux.do', 0, 'read',
   'https://connect.linux.do/oauth2/authorize',
   'https://connect.linux.do/oauth2/token',
   'https://connect.linux.do/api/user',
   20);

-- 2. 用户 OAuth 身份表
CREATE TABLE user_oauth_identities (
  id                BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT       NOT NULL,
  provider          VARCHAR(32)  NOT NULL,
  provider_user_id  VARCHAR(128) NOT NULL,
  union_id          VARCHAR(128) NULL,
  username          VARCHAR(128) NULL,
  email             VARCHAR(160) NULL,
  avatar_url        VARCHAR(512) NULL,
  raw_payload       JSON         NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_provider_userid (provider, provider_user_id),
  UNIQUE KEY uk_user_provider   (user_id, provider),
  KEY idx_provider_union        (provider, union_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 把存量飞书绑定回填到 identities 表（向后兼容）
INSERT INTO user_oauth_identities
  (user_id, provider, provider_user_id, union_id, avatar_url, created_at, updated_at)
SELECT id, 'feishu', feishu_open_id, feishu_union_id, feishu_avatar_url, NOW(), NOW()
FROM users
WHERE feishu_open_id IS NOT NULL
  AND feishu_open_id <> '';
```

`users.feishu_*` 列保留作向后兼容的快速读取路径；v1 不删，留待后续清理 migration。

## 3. 后端模块结构

新增包 `com.skillstack.auth.oauth`：

```
auth/oauth/
  entity/
    OAuthProvider.java
    UserOAuthIdentity.java
  mapper/
    OAuthProviderMapper.java
    UserOAuthIdentityMapper.java
  service/
    OAuthProviderService.java        # CRUD + 运行时读取（带缓存 + admin 写后立即失效）
    OAuthStateStore.java             # HMAC-signed state，所有 provider 共用
    OAuthIdentityService.java        # upsert identity；首登创建 user；handle 候选生成
    OAuthService.java                # 入口：buildAuthorizeUrl / handleCallback
  feishu/
    FeishuAuthClient.java            # interface
    HttpFeishuAuthClient.java        # 从现有 FeishuAuthService 抽出来
    FeishuTokenResponse.java
    FeishuUserProfile.java
  linuxdo/
    LinuxDoOAuthClient.java          # ← 复制自 shenma-gallery
    HttpLinuxDoOAuthClient.java      # ← 复制
    LinuxDoTokenResponse.java        # ← 复制
    LinuxDoUserProfile.java          # ← 复制
  dto/
    PublicProviderVO.java            # 公开 endpoint 用，仅 code/displayName/buttonLabel/iconUrl
    AdminProviderVO.java             # admin endpoint 用；client_secret 字段返回脱敏
    UpdateProviderReq.java
    AuthUrlVO.java
```

`auth/service/FeishuAuthService.java` 重构为 `auth/oauth/feishu/FeishuAuthAdapter`，
不再用 `@Value`：构造时由 Spring 注入 `OAuthProviderService`，每次发起 OAuth 都从
DB 加载当前 provider 配置。`application.yml` 中的 `skillstack.feishu.*` 完全移除。

`OAuthProviderService` 行为：

- 启动时把全部 provider 装入 `ConcurrentHashMap`，并设置 60s TTL。
- `requireConfigured(code)`：返回 enabled provider 的快照副本（含 secret，仅服务端用）；
  若 disabled 抛 `OAUTH_PROVIDER_DISABLED`；若 client_id / client_secret / redirect_uri /
  必要 URL 为空抛 `OAUTH_PROVIDER_MISCONFIGURED`。
- `listPublic()`：仅返回 enabled provider 的 `PublicProviderVO`，过滤 secret。
- `update(code, req, actorId)`：写表 + 失效本地缓存；写审计日志（payload 不含 client_secret 明文）。

`OAuthStateStore` 行为（参考 shenma-gallery 的 `OAuthService.createState/verifyState`）：

- 用 `app.oauth.state-secret`（新 env）做 HMAC-SHA256 签名。
- payload 格式：`<base64url(returnTo)>.<expiresAt>.<nonce>.<sig>`。
- TTL 默认 600s，可由 `app.oauth.state-ttl-seconds` 覆盖。
- `verify(state)` 校验签名 + 过期。v1 仅做签名 + 过期校验（与 shenma-gallery 一致），
  不强校验 nonce 一次性；nonce 字段仍写入 payload，为后续叠加 redis 黑名单 / 一次性消费保留扩展点。

`OAuthIdentityService` 行为：

1. `loginOrCreate(provider, profile)`：先按 `(provider, provider_user_id)` 查 identity；
   命中则 `updateSnapshot` 后返回对应 user；未命中走"首登注册"。
2. 首登注册：
   - `handle` 候选：linux.do 取 `username`，飞书取拼音（先 `name`→ASCII 简化；不可解析则
     落回 `feishu_<openId 前 6 位>`）。
   - 用 `normalizeUsername`：小写、`[^a-z0-9_]→_`、压缩重复下划线、长度限制 3–24。
   - 冲突追加 `_2 / _3 ...`，上限 1000；超出加随机 8 位后缀。
   - email 用 profile.email（合法且未占用）；否则生成 `<provider>_<id>@oauth.local`。
   - 创建 User（`platform_role=USER`, `status=ACTIVE`），插入 identity 行。
3. 后续登录同 provider 命中 identity → 直接 issue JWT；并刷新 identity 的
   `username/email/avatar_url/raw_payload/updated_at`。

`OAuthService` 行为：

- `buildAuthorizeUrl(code, returnTo)` → `{authUrl, state}`：拼接 provider 的
  `authorize_url + response_type=code + client_id + redirect_uri + scope + state`。
- `handleCallback(code, query)`：校验 state → 取 token → 拉 userinfo → `loginOrCreate` →
  返回 `LoginRes`。

## 4. 后端 API

### 4.1 公开端点（`SecurityConfig` 白名单）

| Method | Path | 说明 |
|---|---|---|
| GET  | `/api/auth/providers`                       | 列出 enabled provider 的 `PublicProviderVO` 数组（仅 code/displayName/buttonLabel/iconUrl/sortOrder） |
| GET  | `/api/auth/oauth/{provider}/url`            | 返回 `{authUrl, state}`；disabled 抛 `OAUTH_PROVIDER_DISABLED` |
| GET  | `/api/auth/oauth/{provider}/callback?code=&state=` | 返回 `LoginRes`；自动 upsert identity |

向后兼容（保留至少一个版本）：

| Method | Path | 说明 |
|---|---|---|
| GET  | `/api/auth/feishu/url`        | 内部 delegate 到 `/api/auth/oauth/feishu/url` |
| GET  | `/api/auth/feishu/callback`   | 内部 delegate 到 `/api/auth/oauth/feishu/callback` |

### 4.2 管理端点（`@RequireSuperAdmin`）

| Method | Path | 说明 |
|---|---|---|
| GET  | `/api/admin/oauth-providers`               | 列表：返回 `AdminProviderVO[]`，`clientSecret` 字段恒为 `null` 或 `***`，并附加 `clientSecretSet: boolean` |
| GET  | `/api/admin/oauth-providers/{code}`        | 详情（同上脱敏） |
| PUT  | `/api/admin/oauth-providers/{code}`        | 部分更新；body 形如 `UpdateProviderReq`；`clientSecret` 为 `null` 或缺省表示**不变**，传空串表示**清空**，传非空表示更新 |

`UpdateProviderReq` 字段（全部可选）：

```
displayName, enabled, clientId, clientSecret, redirectUri, scope,
authorizeUrl, tokenUrl, userinfoUrl, iconUrl, buttonLabel, sortOrder, extraJson
```

### 4.3 错误码

| 错误码 | 含义 |
|---|---|
| `40030` | OAuth state 失效（含签名错误 / 过期） |
| `40031` | OAuth 回调缺少必要参数（code / state） |
| `40032` | 调用 provider API 失败（token / userinfo） |
| `40033` | provider 未配置完整（缺 client_id / secret / redirect_uri / 端点 URL） |
| `40034` | provider 已被关闭（`OAUTH_PROVIDER_DISABLED`） |
| `40035` | provider code 未识别 |

## 5. 前端

### 5.1 文件变化

```
frontend/src/
  api/
    endpoints.ts                     # 增 authApi.providers / oauthUrl / oauthCallback；保留旧 feishuUrl/feishuCallback 作 thin wrapper
    admin.ts                         # 增 useAdminOAuthProviders / useUpdateOAuthProvider
  pages/
    auth/
      Login.tsx                      # 改：移除硬编码飞书按钮 + 文案，渲染 providers list；为空时隐藏 OAuth 区块
      AuthCallback.tsx               # 改：通用化；路由 `/auth/oauth/:provider/callback`，旧 `/auth/feishu/callback` 仍可用
    admin/
      AdminLayout.tsx                # 侧栏加 "登录方式"
      OAuth.tsx                      # 新页：表格 + 行内编辑
  router.tsx                         # 增 /admin/oauth；增 /auth/oauth/:provider/callback；保留 /auth/feishu/callback
```

### 5.2 登录页行为

- 挂载时调 `GET /api/auth/providers`：
  - 数组为空 → 不渲染 OAuth 区块（用户仍可走验证码 / 密码）。
  - 非空 → 按 `sortOrder` 升序渲染按钮列表；每个按钮文案 = `buttonLabel || displayName`，
    带 `iconUrl` 图标，无 icon 时用 `lucide-react` 的 `LogIn` 占位。
- 点击 → `GET /api/auth/oauth/{code}/url` → `sessionStorage.setItem('skillstack.auth.next', next)`
  → `window.location.assign(authUrl)`。
- 错误码 `40033 / 40034` → 显示"该登录方式暂不可用，请使用其他方式"。

### 5.3 Callback

新通用路径 `/auth/oauth/:provider/callback`：从路由参数取 `provider`，从 query
取 `code / state`，调 `GET /api/auth/oauth/{provider}/callback`。成功后流程与现有
`AuthCallback` 一致。

旧路由 `/auth/feishu/callback` 保留，组件内部把 provider 写死为 `feishu` 后走同一逻辑，
最终下版本删除。

### 5.4 Admin `/admin/oauth`

页面布局：

```
DashTopBar
  title: 登录方式
  hint:  管理第三方登录的启用状态与参数

Card（每个 provider 一张）
  header: [logo] {displayName}    [enabled toggle]    [保存按钮]
  body:
    显示名称
    登录按钮文案
    图标 URL
    Client ID
    Client Secret  (placeholder = "已设置，留空表示不变"；clientSecretSet 为 true 时)
    Redirect URI
    Scope
    高级（折叠）
      Authorize URL
      Token URL
      Userinfo URL
      Sort Order
      Extra JSON（多行文本）
```

行为：

- 每张 Card 独立维护本地 draft，"保存"按钮调 `PUT /api/admin/oauth-providers/{code}`
  后 invalidate 列表。
- enabled 切换为独立保存（即点即生效）。
- Client Secret 字段：默认不显示已存值；`clientSecretSet` 为 true 时输入框 placeholder
  显示 `已设置（留空表示不变）`；提供"清空 Secret"按钮。
- 危险操作：把 enabled 关掉时弹确认 dialog，说明"已登录用户不受影响，但新登录将不可用"。

## 6. 安全与配置

- 新增配置项（`application.yml`）：
  - `app.oauth.state-secret` —— state HMAC secret，必须配置；启动检测为空时抛错日志，
    所有 OAuth endpoint 返回 503，避免运行时 NPE。
  - `app.oauth.state-ttl-seconds` —— 默认 600。
  - `app.oauth.frontend-origin` —— 默认 `http://localhost:5173`；用于必要时拼前端回跳 URL。
- 移除：`skillstack.feishu.app-id / app-secret / redirect-uri`（飞书参数全部走 DB）。
- 升级路径：本次 V25 不写存量飞书配置 INSERT，由超管首次进入 `/admin/oauth` 时填入。
  若现有部署需要不中断飞书登录，可在 README 中给出 SQL 模板，运维直接 `UPDATE oauth_providers` 一次。
- `SecurityConfig` 白名单新增：
  - `GET /api/auth/providers`
  - `GET /api/auth/oauth/**`
  - 保留旧 `GET /api/auth/feishu/**`

## 7. 审计日志

`admin_audit_log` 写入时机：

- `PUT /api/admin/oauth-providers/{code}` 成功后写一条 `action=oauth.provider.update`，
  `payload_json` 含变更前后字段对比；**`client_secret` 字段只在 payload 中标记
  `clientSecretChanged: true/false`，绝不存明文**。

## 8. 验证策略

### 8.1 后端

- `mvn test`：
  - `OAuthStateStoreTest` —— 正常签发 + 校验、过期、篡改、缺字段。
  - `OAuthProviderServiceTest` —— 部分更新、`clientSecret null/空串/非空` 三态、disabled 过滤、缓存失效。
  - `OAuthIdentityServiceTest` —— 首登创建、handle 冲突追加、email 兜底、existing identity 复用。
  - `LinuxDoAuthAdapterTest` —— mock `LinuxDoOAuthClient` 跑完整 callback 流程。
  - `FeishuAuthAdapterTest` —— 重写现有 `FeishuAuthServiceTest`，改 mock DB 配置 + HTTP 客户端。
  - `AdminOAuthControllerTest` —— `@RequireSuperAdmin` 拦截、secret 脱敏、审计日志生成。
- `mvn -q -DskipTests compile`。

### 8.2 前端

- `npm run lint`、`npm run build` 通过。
- 浏览器 smoke：
  1. `/admin/oauth` 默认状态：两张 Card，enabled=false；登录页不显示 OAuth 区块。
  2. 配置 linux.do 参数并开启 → 登录页出现 linux.do 按钮 → 点击跳转 → 完成回调登录。
  3. 配置飞书并开启 → 同时存在两个按钮；按 sort_order 顺序。
  4. 把 linux.do 关掉 → 登录页该按钮消失。
  5. 用 linux.do 注册的新用户 → handle 自动生成；重复同名时 `_2` 追加。
  6. `clientSecret` 留空保存 → 后端不变；填入新值 → 下次登录走新 secret。

## 9. 分阶段实施建议

1. **migration + Provider 配置 CRUD（无 OAuth flow 改动）**：跑通 `/api/admin/oauth-providers`、
   admin UI。`/auth/feishu/*` 此时仍走旧 `@Value`，未割接。
2. **OAuthStateStore + OAuthService 通用 flow + FeishuAuthAdapter 切到 DB 配置**：
   旧 endpoint delegate 到新 service；写完测试再上线。
3. **linux.do adapter**：复制 shenma-gallery 4 个文件 + 写 `LinuxDoAuthAdapter` + 单测。
4. **前端登录页改造 + Admin OAuth 页**：动态按钮 + Card 编辑。
5. **下线 `application.yml` 中的飞书三键**：在 README 中给出迁移 SQL；删除 `@Value`。
6. **存量 identity 回填 + 移除老 `users.feishu_*` 列**（下个里程碑，本设计不含）。

各阶段独立可发布，前后端契约保持向后兼容（旧路由保留）。

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 超管误关掉所有 provider 且尚未配密码登录 | enabled 切换二次确认；保留密码 / 验证码登录通路 |
| client_secret 明文落库 | v1 仅靠 DB 访问控制；后续可叠 AES 列改造（schema 不变） |
| 同 username 不同 provider 的 handle 撞车 | `normalizeUsername` + `_2/_3` 追加；上限 1000 后随机后缀 |
| 旧前端缓存 `/auth/feishu/callback` 链接 | 旧路由保留一个版本 |
| state secret 配错 / 未配 | 启动期校验；未配时 OAuth endpoint 全局 503 + 日志告警 |
| linux.do API 限频或不可达 | `LinuxDoOAuthClient` 8s connect / 12s read 超时；错误统一映射 `40032` |
| 跨多副本部署时 state 校验 | HMAC 签名是无状态的，多副本天然支持；不依赖本地 store |

## 11. 不影响项

- CLI（`smskill`）契约不变。
- 现有 `/team/admin/**` 路由不动。
- JWT 结构不变；`MeRes.platformRole` 已在前置设计中提供。
- `/api/site/branding` 等公开 endpoint 不变。
