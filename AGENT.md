# AGENT.md

本文件是 `skill-team-share` 仓库的唯一主维护文档。所有自动化代理在本仓库内执行分析、改代码、写文档、调试或验证时，都应优先遵循这里的约定。

`AGENTS.md` 和 `CLAUDE.md` 只作为入口引用本文件，不再单独维护项目规则。

## 项目定位

SkillStack 是一个团队内的 Skill 分享与管理平台，用于快速沉淀、审核、检索、复用团队中的 skill、套件、经验与成员贡献信息。

核心目标：

- 让团队成员能提交、维护和发现可复用的 skill。
- 让管理员能审核 skill、管理成员、维护邀请和团队配置。
- 让公开页面能展示已发布、已审核的公共 skill。
- 让团队内部页面围绕团队协作、资产管理和复用效率展开，而不是做泛社区内容平台。

优先级：

1. 团队内 skill 管理与复用流程
2. skill 提交、版本、审核、发布与下载
3. 团队成员、角色、邀请与权限
4. 套件、活动流、搜索与公开展示
5. 外围宣传、复杂社区化能力和非核心 AI 功能

## 技术栈

前端：

- Vite
- React 18
- TypeScript
- Tailwind CSS
- React Router
- TanStack Query
- Axios
- Zustand
- Radix UI / shadcn 行为组件
- lucide-react 作为补充图标来源

后端：

- Java 17
- Spring Boot 3.2
- Spring Security
- MyBatis Plus
- MySQL 8
- Flyway
- JWT
- springdoc OpenAPI

CLI：

- Node.js 20+
- TypeScript 5.x
- commander, axios, zod, chalk, ora, cli-table3, yauzl, @inquirer/checkbox（install 交互式多选 agent）
- vitest
- npm 包名：`smskill`，已发布到 npm 官方 registry；用户安装优先使用 `npm install -g smskill` 或 `npx smskill@latest`，仓库内 `cli/install.sh` 仅用于本地开发 link 与安装 `skillstack-installer` chat skill。

基础设施：

- `docker-compose.yml` 启动 MySQL，宿主端口为 `3307`，容器内端口为 `3306`。
- `scripts/services.sh` 是本地一键服务管理入口。
- 这是一个 microservices-ready monorepo，前后端在同一仓库内协作。

## 主要目录

- `frontend/`：React + Vite 前端应用。
- `frontend/src/api/`：前端 API client 与 endpoint 集合。
- `frontend/src/components/`：前端组件。`components/ui/index.ts`、`icons.tsx`、`lib/tokens.ts`、`lib/utils.ts`、`lib/visualAssets.ts` 现为 `@skillstack/ui` 的再导出 shim，原始实现已移到共享包；`AvatarUpload`/`IconUpload`/`atoms/PromptCard` 因依赖 `@/api` 仍留在 frontend 本地。
- `frontend/src/mocks/`：前端 mock 数据与类型。
- `frontend/src/pages/`：前端页面。
- `packages/ui/`：跨端共享设计系统包 `@skillstack/ui`（设计 token 单一来源 + ui 原子组件 + icons + cn/visualAssets）。frontend 与 desktop 通过 Vite alias + tsconfig paths **源码直连消费**（不单独构建），各 app 仅用 shim 再导出，保证零调用点改动。新增/修改设计系统改这里。包自带 `@types/react` 保证类型自洽，无需各 app 配 react path override。
- `desktop/`：Electron 桌面客户端（独立 Vite + React 应用）。UI 全部复用 `@skillstack/ui` 原子，仅保留桌面专属件（`transientScrollbar`、窗口 chrome、Electron 桥接）。
- `cli/`：终端 CLI `smskill`（Node + TS），用于消费 SkillStack；发布包只包含 `dist/cli.js`、`README.md` 与 `package.json`。
- `cli/src/commands/`：命令实现（auth / config / search / info / install / list / remove / suite / prompt / upload）。
- `cli/src/core/`：API 客户端、配置、lockfile、安装解压、agent 目标矩阵。`install` 默认把真实内容装到 `~/.agents/skills/<slug>`（project scope 为 `<cwd>/.agents/skills`），各 agent 目录用软链指向它；`--dir` 为直装例外。解压会剔除 macOS `__MACOSX`/`.DS_Store`/`._*` 垃圾条目。
- `backend/`：Spring Boot 后端。
- `backend/src/main/java/com/skillstack/`：后端业务代码。
- `backend/src/main/resources/db/migration/`：Flyway migration。
- `scripts/services.sh`：本地服务启动、停止、重启、状态检查。
- `docs/superpowers/`：设计、计划与阶段性工程文档。
- `plan.md`：项目路线图和阶段任务。
- `CLAUDE.md`：仅引用本文件。
- `AGENTS.md`：仅引用本文件。

## 产品边界

### 团队功能是核心

涉及功能设计或取舍时，优先保证团队内真实工作流：

- 团队首页与工作台
- team skill library
- skill 创建与提交
- skill 版本管理
- 审核队列
- 成员与角色
- 邀请与加入
- suite / collection
- 活动流与团队动态
- 当前用户账户维护

不要把 first version 设计成泛内容社区、营销站或 AI 工具广场。

### 公共广场保持轻量

`/plaza` 和公开 `GET /api/skills` 只展示公开且已审核的 skill。公共广场优先保留搜索能力，不默认扩展复杂筛选、推荐、社区动态或个性化排序。

团队库和公共广场应保持查询边界清晰：

- 公共广场：面向匿名或外部访问，返回 `PUBLIC + APPROVED` 数据。
- 团队库：面向登录团队成员，允许团队维度、角色维度、状态维度的管理查询。

## 本地运行

优先使用一键脚本：

```bash
./scripts/services.sh start
./scripts/services.sh status
./scripts/services.sh stop
./scripts/services.sh restart
./scripts/services.sh help
```

一键启动会启动 MySQL、后端和前端。通常服务地址为：

- 前端：`http://localhost:5173`
- 后端 API：`http://localhost:8080`
- Swagger：`http://localhost:8080/swagger-ui.html`
- MySQL：`localhost:3307`
- MySQL root 密码：`skillstack`
- MySQL 用户：`skillstack`
- MySQL 密码：`skillstack`
- MySQL 数据库：`skillstack`

一键启动预期耗时约 15 秒，具体取决于本机依赖缓存和服务状态。

手动启动：

```bash
docker compose up -d mysql

cd backend
mvn spring-boot:run

cd frontend
npm install
npm run dev
```

单独停止 MySQL：

```bash
docker compose down mysql
```

首次初始化：

```bash
cd frontend
npm install

cd ..
./scripts/services.sh start
```

## 前端约定

前端编码规范（UI/样式、Tailwind Preflight 行内 style 铁律、数据访问、路由页面、前端命令）已抽取为项目级 skill。**编写、修改、审查或提交前端代码时阅读它**：

- Skill：`frontend-standards`（源文件 `.claude/skills/frontend-standards/SKILL.md`，`.codex/skills/` 下软链同步，Claude 与 Codex 共用）

## 后端约定

后端编码规范（API 风格、模块边界、后端命令、数据库与 Flyway migration 命名规范、权限与安全、存储 URL 铁律）已抽取为项目级 skill。**编写、修改、审查或提交后端代码时阅读它**：

- Skill：`backend-standards`（源文件 `.claude/skills/backend-standards/SKILL.md`，`.codex/skills/` 下软链同步，Claude 与 Codex 共用）

新增或变更前后端规范时，改对应 skill 文件即可，本节只保留入口指引，不再复制内容。

## 验证命令

按改动范围选择最小充分验证：

```bash
cd backend && mvn test
cd backend && mvn -q -DskipTests compile
cd frontend && npm run lint
cd frontend && npm run build
```

前端页面或交互改动完成后，应尽量做浏览器 smoke check，至少覆盖相关路由能打开、关键数据能渲染、主要按钮不会立刻报错。

如果验证失败，必须区分：

- 本次改动引入的问题
- 工作区已有未提交改动导致的问题
- 环境或依赖不可用导致的问题

没有真实执行验证时，不要声称“通过”。

## 常见排查

后端无法启动：

```bash
tail -f /tmp/skillstack-backend.log
docker ps | grep skillstack-mysql
cd backend && mvn clean && mvn spring-boot:run
```

前端无法连接 API：

- 先确认后端可访问：`http://localhost:8080/swagger-ui.html`。
- 检查浏览器 console 是否有 CORS 或代理错误。
- 检查前端 API 配置和 Vite proxy。

端口占用：

```bash
lsof -ti:5173 | xargs kill -9
lsof -ti:8080 | xargs kill -9
./scripts/services.sh restart
```

MySQL 连接异常：

```bash
docker ps | grep mysql
docker compose restart mysql
docker compose logs mysql
```

注意：不要终止非当前任务启动的进程，除非用户明确要求。

## 开发工作流

### 默认流程

1. 先读相关 README、已有文档、代码和最近约定。
2. 明确目标、边界、风险和验证方式。
3. 保持局部修改，不做无关重构。
4. 优先复用现有组件、Service、DTO、Mapper 和工具函数。
5. 修改后运行与范围匹配的验证。
6. 最终回复中说明改了什么、验证了什么、还有什么风险。

轻量任务可以不写独立 design doc；涉及公共 API、schema、权限、跨模块行为或大范围 UI 流程时，应先补简短设计或计划。

### 并行协作

只有任务能自然拆成互不冲突的前端、后端、测试或文档子任务时，才使用并行子代理。默认不要让多个代理修改同一个文件、同一个 shared contract、同一 migration 或根配置。

禁止子代理自行执行 merge、rebase、push、删除 worktree 或清理其他人的改动。

### Git 与工作区安全

- 进入任务后先查看 `git status --short`。
- 不要回滚用户或其他代理的未提交改动。
- 不要使用 `git reset --hard`、`git checkout -- <file>` 等破坏性命令，除非用户明确要求。
- 不要删除文件，除非任务明确需要且范围清楚。
- 构建产物、日志和临时文件不应混入业务提交。

## Spec / Bug 飞书多维表格同步规范

我们已进入多人协作开发模式。所有 spec 需求与 bug 的进度，统一在飞书多维表格（Base）中维护，作为团队唯一进度看板。

完整规范（Base 坐标、触发时机、字段映射、写入示例、易错点）已抽取为项目级 skill，触发同步动作时阅读它：

- Skill：`spec-base-sync`（源文件 `.claude/skills/spec-base-sync/SKILL.md`，`.codex/skills/` 下软链同步）
- 触发时机概要：新增 spec / 开发状态变更 / 新增 bug / bug 状态流转。
- 操作工具：统一用 `lark-cli base +...`（飞书 `lark-base` skill），写记录前先 `+field-list`。

新增或变更上述同步约定时，改 skill 文件即可，本节只保留入口指引，不再复制内容。

## 编码质量

- 函数保持短小，复杂逻辑拆到清晰的私有方法或 Service。
- Controller 只做协议适配，不承载复杂业务逻辑。
- 前端组件优先关注展示和交互，数据转换与请求逻辑放到 API 层或 hook。
- 命名要表达业务含义，避免 `data1`、`tmp`、`handleClick2`。
- 边界状态要显式处理：loading、empty、error、unauthorized、forbidden。
- 不为未来可能性过度抽象，先满足当前团队 skill 平台的核心工作流。

## 文档维护

只维护本文件作为项目规则和运行说明的主入口。`AGENTS.md` 与 `CLAUDE.md` 只保留引用，不复制内容。

当新增或改变以下内容时，应同步更新本文件或对应专项文档：

- 启动方式、端口、环境变量
- API contract
- 数据库 schema / migration
- 团队工作流或权限规则
- 重要产品边界和设计决策
- 本地验证方式

如果经验会反复影响后续 agent 工作，可以补充到本文件；如果只是阶段性计划，应放到 `docs/superpowers/` 或任务对应文档中。

## 相关文档

- `plan.md`：项目路线图和当前阶段任务。
- `backend/README.md`：后端专项说明。
- `frontend/README.md`：前端专项说明。

## CI/CD 与部署

CI/CD 与部署流程后续配置；在明确配置前，不要假设已有自动发布链路。
