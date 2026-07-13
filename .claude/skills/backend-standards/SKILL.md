---
name: backend-standards
description: Use when 编写、修改、审查或提交本仓库后端代码（backend/ 下的 Java 17 + Spring Boot + MyBatis Plus + MySQL），涉及 Controller/Service/DTO、ApiResponse/分页、模块边界、Flyway migration、数据库/SQL、JWT/SecurityConfig/OAuth、密码/短信验证码、avatar/logo 等 storage key → URL 字段时。仅在写代码/代码审查/提交代码场景触发。skill-team-share 专属约定。
---

# 后端标准规范

约束本仓库 `backend/`（Java 17 + Spring Boot 3.2 + Spring Security + MyBatis Plus + MySQL 8 + Flyway + JWT）的编码规范。写代码、审查、提交前对照执行。

## API 风格

- Controller 路径使用 `/api/{module}/...`。
- 所有接口返回 `ApiResponse<T>`。
- 分页参数使用 `PageQuery`，分页结果使用 `PageResult<T>`。
- DTO 入参使用 `@Valid` 和 JSR-303 注解。
- 业务错误抛 `BusinessException(code, message)`，由全局异常处理统一返回。
- 当前用户通过 `@AuthenticationPrincipal CurrentUser me` 获取。
- Controller 只做协议适配，不承载复杂业务逻辑；复杂逻辑拆到 Service 的私有方法。

## 模块边界

- `auth/`：登录、注册、当前用户、账户资料、密码、手机号等。
- `team/`：团队、成员、邀请、未读信息等。
- `skill/`：skill、版本、分类、标签、下载、公开广场查询等。
- `review/`：审核流程。
- `suite/`：skill 套件。
- `activity/`：活动流。
- `common/`：通用配置、实体、异常、安全、web 返回结构。

不要把团队权限、当前用户账户、skill 状态流转等共享规则散落到 Controller 中；优先收敛在对应 Service。

## 后端命令

```bash
cd backend
mvn spring-boot:run
mvn test
mvn -q -DskipTests compile
```

- 后端默认端口 `8080`。
- Swagger UI：`http://localhost:8080/swagger-ui.html`，含当前可用 API endpoint 与 request/response schema。
- Flyway 会在后端启动时自动执行 migration。

## 数据库

- MySQL 由 `docker-compose.yml` 管理。宿主机端口 `3307`，容器内 `3306`。数据库名/用户/密码均为 `skillstack`。
- 本地开发必须使用 `./scripts/services.sh start` 起的 Docker MySQL，禁止多人共用同一台开发库；共享库只在 staging/prod 由 CI 统一 migrate。
- migration 文件必须放在 `backend/src/main/resources/db/migration/`。
- 使用 Flyway 追加 migration，不要改已经发布或已被其他人依赖的历史 migration。
- 表结构和数据变更必须考虑 seed 数据、测试数据和本地启动。
- 数据库访问使用 MyBatis Plus 与参数化查询，不要拼接 SQL。
- 逻辑删除走 `deleted` 字段和 MyBatis Plus 约定。

### Flyway migration 命名规范

为避免多人 / 多 AI 协作时版本号撞车，新增 migration 必须使用时间戳版本号，不再用顺序 +1：

- 新增 migration 命名格式：`V{YYYYMMDD_HHMMSS}__{snake_case_desc}.sql`
  - 示例：`V20260527_153000__add_user_phone_index.sql`
  - 时间戳取本地创建时刻，精确到秒。
- 历史 `V1__` ~ `V28__` 这种顺序号 migration **保持不动**，规范只对新增生效。改名会触发 `flyway_schema_history` 的 checksum / 版本号校验失败。
- `application.yaml` 已开启 `spring.flyway.out-of-order: true`，允许后到的旧时间戳补进 history，不需要严格递增。
- 生成新 migration 前，先 `ls backend/src/main/resources/db/migration/ | tail` 看一眼最近文件名，再决定时间戳和描述，避免与同事/同分支 in-flight 文件撞名。
- 禁止在任何共享库（含队友的本地库）执行 `flyway clean`；本地 Docker MySQL 想重来用 `docker compose down -v mysql && ./scripts/services.sh start`。
- checksum 不一致时使用 `flyway repair` 修历史记录，但**禁止**通过修改已执行过的 migration 文件去"修复"问题——只能再追加一条新 migration 修正。

## 权限与安全

- 除明确公开接口外，默认接口需要 JWT。
- 公开接口包括登录注册、公共 skill、公共团队页、公共用户页、分类、Swagger / actuator 等既有白名单。
- 修改 SecurityConfig 时必须同步检查前端路由、API 调用和 smoke 路径。
- 不要把密码、JWT secret、短信验证码、cookie、API key 写入源码或文档示例。
- 修改账户相关能力时，优先检查密码校验、SMS code 校验、唯一性约束和错误返回。
- OAuth `state` HMAC secret 不需要手工配置：`app.oauth.state-secret` 留空时，`OAuthStateStore` 首启会经 `common/systemconfig/SystemConfigService` 自动生成并持久化到 `system_config` 表（key=`oauth.state_secret`）。env 显式配置仍优先，用于跨实例共享或固定值。飞书等 provider 级密钥仍走 `oauth_providers` 表 + admin 页面，二者不要混淆。

## 存储 URL 铁律（avatar / team logo / 任何 uploads 字段）

数据库列约定：`avatar_url`、`logo_url` 等存的是 **storage key**（如 `avatars/123/uuid.jpg`），不带 `/uploads` 前缀；`feishu_avatar_url` 等外部来源列存的是 **完整 URL**。对外响应必须是可访问的完整 URL。

铁律：

- **新增任何 “DB 存 storage key、对外返回完整 URL” 字段，必须走统一通道。禁止在 Service 里手写 `storageService.resolveUrl(...)` 拼接。**
- MyBatis Mapper 查询：
  - SQL 用 `COALESCE(<上传 key 列>, <外部兜底列>) AS xxx` 一步出值。
  - `@Results` 里加 `@Result(column = "xxx", property = "xxx", typeHandler = StorageUrlTypeHandler.class)`，由 `common/storage/StorageUrlTypeHandler` 自动解析。
- 非 MyBatis 路径（`User` / `Team` 等实体 → DTO 命令式装配、`JdbcTemplate` 行映射、Controller 上传响应）：
  - 用 `StorageUrlResolver.resolveSingle(value)`（单值）或 `resolve(primary, fallback)`（按 “上传 → 兜底” 优先级）。
  - 不要在 Service 里 `if (key != null) storageService.resolveUrl(key)`，必须走 resolver，保证幂等和 null 处理一致。
- **禁止给 `User.avatarUrl` 等实体字段挂 `@TableField(typeHandler = StorageUrlTypeHandler.class)`**。原因：`UserService.uploadAvatar` 必须拿 raw key 去 `storageService.delete(...)` 清理旧文件；entity 字段被解析后会导致老头像永远删不掉、存储泄漏。entity 一律保持 raw 值，解析只发生在 DTO 层。
- 列设计层面，新增此类列：DB 落 raw key，response DTO 字段命名以 `*Url` 结尾，前端约定字符占位字段（如 `avatar`）和图片字段（如 `avatarUrl`）分开。
- 前端约定：Avatar / Logo 组件必须同时收 `char`（字符兜底）和 `url`（图片 URL），新增展示用户/团队头像的地方必须把后端的 `avatarUrl` / `logoUrl` 透传给 `url` prop，不要只传 `char`。

新增 “DB key → 对外 URL” 字段时，按以上规则走完一遍后，response 字段全链路（SQL → DTO → JSON → 前端 `<Avatar>`）才算合上。
