# SkillStack Backend

Spring Boot 3.2 + MyBatis Plus + MySQL 8 + Flyway + JWT。

## 启动

```bash
# 1. 起 MySQL（仓库根目录）
docker compose up -d

# 2. 可选：开启飞书登录（回调地址需与飞书开放平台配置一致）
export FEISHU_APP_ID=cli_xxx
export FEISHU_APP_SECRET=xxx
export FEISHU_REDIRECT_URI=http://localhost:5173/auth/callback

# 也可以把上面 3 个变量写到仓库根目录 `.env` 或 `backend/.env`。

# 3. 起 Spring Boot
cd backend
mvn spring-boot:run
```

- 端口：`http://localhost:8080`
- OpenAPI/Swagger：`http://localhost:8080/swagger-ui.html`
- MySQL：`localhost:3306` (库 `skillstack`，账号 `skillstack/skillstack`)

启动时 Flyway 会自动执行 `db/migration/V1__schema.sql` + `V2__seed.sql`。

## 测试账号

seed 里所有用户密码统一为 `password`，bcrypt hash 已写死。

| handle | name | 角色（ludou-fe）|
|---|---|---|
| lin_zr  | 林子睿 | OWNER  |
| zhao_yc | 赵一辰 | ADMIN（"我"）|
| wu_jh   | 吴嘉禾 | ADMIN  |
| chen_yx | 陈奕笑 | MEMBER |
| huang_t | 黄  桃 | MEMBER |
| sun_lw  | 孙临舞 | MEMBER |
| pan_dq  | 潘鼎清 | MEMBER |
| mo_jr   | 莫俊然 | MEMBER |

---

## 包结构约定（5 个并行 BE agent 看这个）

```
com.skillstack
├── SkillStackApplication.java
├── common/                  ← 本 agent 已建（地基，勿动）
│   ├── config/   SecurityConfig / CorsConfig / MyBatisPlusConfig
│   ├── entity/   BaseEntity
│   ├── exception/ BusinessException / GlobalExceptionHandler
│   ├── security/ JwtUtil / JwtAuthFilter / CurrentUser
│   └── web/      ApiResponse / PageQuery / PageResult
├── auth/                    ← BE-Auth
│   ├── controller/ AuthController
│   ├── service/    AuthService
│   ├── mapper/     UserMapper
│   ├── entity/     User
│   └── dto/        LoginReq, RegisterReq, MeRes ...
├── team/                    ← BE-Team
├── skill/                   ← BE-Skill
├── review/                  ← BE-Review
├── suite/                   ← BE-Suite
└── activity/                ← BE-Suite（合并）
```

## 通用约束

1. **Controller 路径**：`/api/{module}/...`（例：`/api/skills`、`/api/teams/{slug}`、`/api/auth/login`）
2. **返回类型**：所有接口返回 `ApiResponse<T>`，使用 `ApiResponse.ok(data)`。
3. **入参校验**：DTO 上加 `@Valid`、字段加 JSR-303 注解。
4. **错误处理**：业务异常抛 `BusinessException(code, message)`，由 `GlobalExceptionHandler` 统一接住。
5. **实体**：所有 entity 继承 `BaseEntity`（含 `id` / `createdAt` / `updatedAt` / `deleted`）。MyBatis Plus 会自动填充时间和逻辑删除。
6. **分页**：用 `PageQuery` 接收参数，返回 `PageResult<T>`。
7. **当前用户**：在 controller 形参上写 `@AuthenticationPrincipal CurrentUser me`，未登录会被 SecurityConfig 拦掉（除非接口放行）。
8. **JWT 生成**：登录成功调用 `jwtUtil.generate(userId, handle)` 返回 token 字符串。前端在 `Authorization: Bearer xxx` 头里携带。
9. **逻辑删除**：`deleted` 字段；查询时 MP 自动过滤，不用手写 `where deleted=0`。
10. **飞书登录**：后端读取 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_REDIRECT_URI`；密钥只放环境变量，不写入前端源码。飞书用户用 `feishu_open_id + feishu_tenant_key` 绑定本地账号，手机号允许为空。

## 已放行（无需 JWT）

- `/api/auth/**`
- `GET /api/skills`、`GET /api/skills/{slug}`（广场公开）
- `GET /api/teams/{slug}`（团队公开页）
- `GET /api/users/{handle}`（用户公开主页）
- `GET /api/categories`
- swagger / actuator / error

其余全部需要 JWT。

## 数据库 schema 速查

15 张表：`users / teams / team_members / skills / skill_versions / suites / suite_items / reviews / invites_code / invites_phone / activity / categories / tags / skill_tags / user_team_unread`

ID 分配（seed 全部用确定 ID，可直接引用）：

| 资源 | id 范围 |
|---|---|
| categories | 1..7 (all/dev/data/design/doc/devops/ai) |
| users | 1..8 (lin_zr/zhao_yc/wu_jh/chen_yx/huang_t/sun_lw/pan_dq/mo_jr) |
| teams | 1..4 (ludou-fe/ludou-be/growth/design) |
| skills | 1..8 (mono-format/api-mock/sql-tidy/env-doctor/i18n-extract/doc-gen/ludou-release/qa-snap) |
| suites | 1..4 (onboard/daily-fe/release-ops/open-source) |
| reviews | 1..4 (r-1042/r-1041/r-1039/r-1037) |
| invites_code | 1..4 |
| invites_phone | 1..4 |
| activity | 1..7 |

「当前登录用户」默认 zhao_yc (id=2)，在 ludou-fe 是 ADMIN，在 ludou-be/growth 是 MEMBER，在 design 是 VIEWER。
