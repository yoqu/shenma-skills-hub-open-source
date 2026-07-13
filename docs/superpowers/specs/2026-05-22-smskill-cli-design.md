# smskill CLI 设计方案

- 状态：设计待评审
- 日期：2026-05-22
- 范围：本仓库新增 `cli/` 模块 + 后端 PAT 鉴权打通
- 参考实现：`/Users/yoqu/Downloads/cli`（Python 版 skillhub，仅作功能参考，不引入代码）

## 1. 目标

为 SkillStack 提供一个终端命令行工具 `smskill`，让团队成员在自己机器上：

- 配置一次服务地址 + Personal Access Token，即可消费私有化或托管版本的 SkillStack。
- 在公共广场与自己所属团队的 skill 之间搜索、查看详情、下载安装。
- 把 skill 装到 **Claude Code / Codex / OpenClaw** 等主流 agent 框架的标准目录里，**装完即可被对应 agent 直接识别**——这是与参考实现最大的差异。
- 通过 `--agent` 与 `--scope` 控制目标路径；不指定时走最普适的默认（Claude Code，用户级）。
- 支持 **套件（suite）一键安装**：拉一份团队套件，把里面的全部 skill 装到同一 agent / scope 下。

非目标（v1 不做）：

- `upgrade` / `self-upgrade` 自更新。
- `init` / `team` / `config init` 等项目脚手架命令。
- Skill 上传 / 发布 / 审核（继续走 web 端）。
- Suite 创建 / 编辑（继续走 web 端）。
- 自动识别 cwd 里有哪些 agent 目录（参见落盘策略 §6.4 评估）。
- 一次安装到多 agent（用户自行多跑几次）。

## 2. 用户场景

1. **个人开发者快速装一个 skill 给 Claude Code 用**：`smskill install weather-helper` → 装到 `~/.claude/skills/weather-helper/`，下次开 Claude Code 直接生效。
2. **团队仓库共享 skill**：`cd my-repo && smskill install code-reviewer --scope project` → 装到 `./.claude/skills/code-reviewer/`，提交进 git，团队所有人 clone 即得。
3. **多 agent 用户切换目标**：`smskill install foo --agent codex` → `~/.codex/skills/foo/`；`smskill install foo --agent openclaw --scope project` → `./skills/foo/`。
4. **本地清单管理**：`smskill list` 列出本机所有 smskill 装过的 skill（含路径 + agent + scope）；`smskill remove foo --agent claude` 卸载指定那条。
5. **CI 场景**：`SMSKILL_API_BASE_URL` + `SMSKILL_TOKEN` + `SMSKILL_AGENT` + `SMSKILL_SCOPE` 环境变量注入，不依赖本地 config 文件。
6. **新人入职一键装套件**：`smskill suite install 1/onboarding-pack`，CLI 拉套件详情，把里面的全部 skill 顺次装到默认 agent / scope。失败的逐条报告，已装的不回滚。

## 3. 架构总览

```
+--------------------------------+
| smskill CLI (Node + TS)        |
|   commander → commands/*       |
|        ↓                       |
|   core/api      (axios)        |
|   core/target   (agent matrix) |
|   core/install  (zip + strip)  |
|   core/lockfile (central)      |
|   core/config   (~/.smskill/)  |
+--------------┬-----------------+
               │ HTTPS
               ▼
+----------------------------+
| Spring Boot backend         |
|  + PAT auth filter (已有)   |
|  + 现有 skill API           |
+----------------------------+
```

CLI 与后端只通过 HTTP / JSON 通讯。CLI 不直接读数据库、不依赖 frontend 任何代码。

## 4. 后端配套改动

### 4.1 现状（已实现）

- `com.skillstack.token` 模块已有 `PersonalAccessToken` 实体、Mapper、Service、Controller（路径 `/api/teams/{teamId}/me/tokens`）。
- Token 前缀 `lst_`，secret 32 字符，存储字段为 `token_hash`（SHA-256）。
- `JwtAuthFilter` 已支持 PAT 鉴权（commit d2e6f12）：
  - 识别 `Authorization: Bearer lst_<secret>`。
  - 命中调 `PersonalAccessTokenService.resolveActive`，构造 `CurrentUser(userId, handle=null)`。
  - 未命中/已撤销 → 401 / 40110，与 JWT 失败一致。
  - **故意限定为"下载凭据"**：只放行 `/api/skills/<slug>` 路径族下的特定子路径，其他路径即便 token 有效也 403。

### 4.2 当前 PAT 允许的路径

读 `JwtAuthFilter.isPatAllowedPath`：

| 路径形态 | 用途 | 状态 |
|---|---|---|
| `/api/skills/<slug>` | skill 详情 | ✅ |
| `/api/skills/<slug>/download` | 下载 zip | ✅ |
| `/api/skills/<slug>/install` | 安装计数 | ✅ |
| `/api/skills/<slug>/versions/<sub>` | 子路径（暂未定义实际接口） | ✅ |
| `/api/skills/<slug>/versions` | 版本列表 | ❌ 见 4.3 |
| `/api/skills`（公开广场列表） | 搜索 | 无需 PAT，公共接口 |
| `/api/teams/{teamId}/suites` | 套件列表 | ❌ 见 4.3 |
| `/api/teams/{teamId}/suites/by-slug/{slug}` | 套件详情 | ❌ 见 4.3 |
| `/api/suites/{id}/install` | 套件安装计数 | ❌ 见 4.3 |
| 其他所有路径（含 `/api/auth/me`） | | 403 |

### 4.3 本期需要的补丁

两块改动：

**A. 补全 skill versions 列表路径**

`isPatAllowedPath` 的 `uri.contains("/versions/")` 只匹配带子段的版本路径，漏掉了无尾段的 `/api/skills/<slug>/versions`。CLI `info` 命令依赖此接口。

**B. 放行 suite 相关三条路径**

CLI 的 `suite list` / `suite info` / `suite install` 都要走这三条。语义上和 skill 下载凭据一致——只读 + 计数，不暴露写入能力。

合并修正：

```java
private static boolean isPatAllowedPath(String uri) {
    if (uri == null) return false;
    // skill 路径族
    if (uri.startsWith("/api/skills/")) {
        return uri.endsWith("/install")
                || uri.endsWith("/versions")           // ← 新增
                || uri.contains("/versions/")
                || uri.endsWith("/download")
                || uri.matches("/api/skills/[^/]+/?");
    }
    // suite 路径族（新增）
    if (uri.matches("/api/teams/\\d+/suites/?")) return true;                    // 列表
    if (uri.matches("/api/teams/\\d+/suites/by-slug/[^/]+/?")) return true;      // 详情
    if (uri.matches("/api/suites/\\d+/install/?")) return true;                  // 计数
    return false;
}
```

新增五条 `JwtAuthFilterPatTest` 用例：
- PAT + GET `/api/skills/foo/versions` → 200。
- PAT + GET `/api/teams/1/suites` → 200。
- PAT + GET `/api/teams/1/suites/by-slug/onboarding` → 200（前提是 suite 存在 + 用户有 membership）。
- PAT + POST `/api/suites/9/install` → 200。
- PAT + GET `/api/auth/me` → 仍 403（回归保护）。

### 4.4 可选改进（不阻塞 v1）

- `last_used_ip` 字段表中已存在但 `resolveActive` 不写。可在 filter 命中后顺手 update 一次，便于安全审计。**留待后续**，本期不做。

### 4.5 数据库

无 migration。`personal_access_token` 表已存在。

## 5. CLI 命令面（v1）

```
smskill config set <key> <value>     # key: apiBaseUrl | token | defaultTeamId
                                     #    | defaultAgent | defaultScope
smskill config get [key]             # 不带 key 列全部；token 自动掩码
smskill config unset <key>
smskill config path                  # 打印 ~/.smskill/config.json 绝对路径
smskill config check                 # 探活：试拉一个 skill 详情验证 baseUrl + token 是否可用

smskill search <query> [--limit 20] [--json]
smskill info <slug>                  # 详情 + 版本列表

smskill install <slug>[@version]
   [--agent claude|codex|openclaw|generic]   # 默认 claude（或 config.defaultAgent）
   [--scope user|project]                    # 默认 user（或 config.defaultScope）
   [--dir <path>]                            # 完全覆盖目标根（与 --agent/--scope 互斥）
   [--force]                                 # 已存在时强制覆盖

smskill list                         # 列出所有已装 skill（来自中心 lockfile）
   [--agent <x>] [--scope <x>]       #   可按 agent/scope 过滤
   [--suite <ref>]                   #   只显示来自某个套件的记录

smskill remove <slug>                # 卸载（需要能唯一定位到一条记录）
   [--agent <x>] [--scope <x>]       #   有歧义时必须带过滤

smskill suite list                   # 列当前 defaultTeamId 的套件
   [--team <teamId>]                 #   覆盖默认 team
   [--limit 20] [--json]

smskill suite info <ref>             # 套件详情 + 内含 skill 列表
                                     #   ref 形如 "1/onboarding-pack" 或 "onboarding-pack"
                                     #   后者用 config.defaultTeamId 补全

smskill suite install <ref>          # 把套件里的全部 skill 装到同一目标
   [--agent <x>] [--scope <x>]       #   所有 skill 共用此目标
   [--dir <path>]                    #   同上
   [--force]                         #   逐条 skill 用 --force 语义
   [--continue-on-error]             #   默认开启；显式 --no-continue-on-error 切换 fail-fast

smskill --help
smskill --version
```

> v1 不提供 `whoami`：现有 PAT 鉴权只允许访问 `/api/skills/*`，`GET /api/auth/me` 不在白名单内，会返回 403。改用 `smskill config check` 走 PAT 实际允许的路径做探活，避免给用户错误印象。

退出码：

- `0` 成功。
- `1` 用户错误（参数缺失、未配置 token 而调用了需要认证的命令、安装目标已存在且未 `--force`）。
- `2` 网络 / 服务端错误（含 4xx 业务错误、5xx、超时）。
- `3` 本地文件系统错误（lockfile 损坏、无写权限、zip-slip 检测拦截）。

### 5.1 目标路径解析（核心）

```
target_root = resolve(agent, scope, --dir)
install_path = target_root / <slug>
```

| agent     | scope=user                  | scope=project                  | 备注 |
|-----------|-----------------------------|--------------------------------|------|
| claude    | `~/.claude/skills/<slug>/`  | `<cwd>/.claude/skills/<slug>/` | Claude Code 官方约定 |
| codex     | `~/.codex/skills/<slug>/`   | `<cwd>/.codex/skills/<slug>/`  | Codex CLI（skills 已替代 custom prompts） |
| openclaw  | `~/.openclaw/skills/<slug>/`| `<cwd>/skills/<slug>/`         | OpenClaw 的 workspace 优先级最高 |
| generic   | `~/.smskill/skills/<slug>/` | `<cwd>/skills/<slug>/`         | 不绑定 agent，纯文件夹 |

`--dir <path>` 完全覆盖 `target_root`，此时 `--agent` / `--scope` 仅作为元数据写入 lockfile，不参与路径计算。

参数源自：CLI flag > 环境变量 (`SMSKILL_AGENT` / `SMSKILL_SCOPE`) > config 文件 (`defaultAgent` / `defaultScope`) > 内置默认 (`claude` / `user`)。

### 5.2 命令细节

#### config

- 文件：`~/.smskill/config.json`，写入时 `chmod 0600`，目录不存在则创建。
- `config get` 不带 key 时输出整份 JSON，但 `token` 字段替换为掩码 `lst_abc12345••••`（保留前缀 12 字符）。
- `config unset` 把对应字段删除并落盘；如果文件因此变空，删除文件本身。

#### config check

- 必须有 `apiBaseUrl`；token 可缺省（仅校验匿名公共接口）。
- 流程：
  1. `GET <apiBaseUrl>/api/skills?size=1`：验证 baseUrl 可达 + 后端是 SkillStack 实例。失败按"网络/服务端错"提示。
  2. 若配置了 token：从上一步结果中拿一个 slug，调 `GET /api/skills/<slug>`（PAT 白名单内），200 即视为 token 有效；401/40110 提示 token 被吊销；403/40300 提示 PAT 形态错误。
  3. 库里一条 skill 都没有时：跳过 token 校验，提示用户去 web 端新建一条 skill 再试。
- 输出示例：`✓ apiBaseUrl OK (...)` / `✓ token OK (id=7)` / `✖ token rejected (40110)`。

#### search

- 调 `GET /api/skills?keyword=<q>&size=<limit>&page=1`。
- 此接口是公开广场 API，匿名 + PAT + JWT 均可访问；不强求配置 token。
- 默认控制台输出 `cli-table3` 表格：slug / name / version / installs / stars / safety。
- `--json` 输出原始 `PageResult<SkillCard>` 字段，便于脚本消费。

#### info

- 并发调 `GET /api/skills/{slug}` 与 `GET /api/skills/{slug}/versions`。
- 两条路径都在 PAT 白名单内（前提是 §4.3 的小补丁已合入）。
- 输出：基本信息 + 最近 5 个版本号、changelog 首行截断。

#### install

- 解析 `<slug>[@version]`；版本缺省走后端 latest。
- 按 §5.1 计算 `install_path`。
- 调 `GET /api/skills/{slug}/download?version=<v>`，得到 zip 字节流。
- 安全解压：
  - 若 `install_path` 已存在且未指定 `--force`：退出码 1，提示用户加 `--force` 或先 `smskill remove`。
  - 指定 `--force` 时：先清空旧目录再解压。
  - **顶层目录剥离**：SkillStack 后端打的包外层是 `<slug>-<version>/`，agent 框架需要 `<slug>/SKILL.md` 直接落在 target_root 下。解压时 strip first path segment，把 `<slug>-<version>/SKILL.md` 还原成 `install_path/SKILL.md`。
  - 解压时校验每个 entry 的目标路径在 `install_path` 之内，防 zip-slip。
- 解压成功后：
  - 在中心 lockfile（§8）追加 / 更新一条记录。
  - 调 `POST /api/skills/{id}/install` 做计数（失败仅 warn，不影响主流程）。
- 输出：`✓ Installed weather-helper@1.2.0 → ~/.claude/skills/weather-helper (agent=claude, scope=user)`。

#### list

- 读中心 lockfile（`~/.smskill/installed.json`），输出表格：slug / version / agent / scope / path / installedAt。
- 支持 `--agent` / `--scope` 过滤。
- **行级实时校验**：每条记录都 stat 一下 `install_path` 是否还存在，不存在的标 `[missing]`（用户可能手动 `rm -rf` 过）。
- lockfile 不存在或为空时友好提示"还没装过任何 skill"。

#### remove

- 用 `<slug>` + 可选 `--agent` / `--scope` 在中心 lockfile 中定位唯一一条记录：
  - 0 条匹配 → 退出码 1，提示 `smskill list` 查看实际记录。
  - 多条匹配 → 退出码 1，提示加 `--agent` / `--scope` 收窄。
  - 1 条匹配 → 删 `install_path` 目录 + 从中心 lockfile 中剔除条目。
- `install_path` 已不存在（之前被手动删）时：仅清理 lockfile 记录，不报错。

#### suite ref 解析

```
parseSuiteRef(input) = {
  teamId: <teamId>,
  slug:   <suite-slug>,
}
```

- `<teamId>/<suite-slug>`：直接切分。teamId 必须为正整数；否则视为非法 → 退出码 1。
- `<suite-slug>`（无斜杠）：teamId 取 `SMSKILL_TEAM_ID > config.defaultTeamId`。两者皆空 → 退出码 1，提示用户显式 `<teamId>/<slug>` 或 `smskill config set defaultTeamId <id>`。
- v1 不支持 team slug 寻址（如 `acme/onboarding-pack`）；调研判断额外加 team-by-slug 接口 + 白名单的代价不值，YAGNI。

#### suite list

- 调 `GET /api/teams/{teamId}/suites?size=<limit>&page=1`。
- teamId 来源同 §suite ref 解析（不带 ref 时回退到 defaultTeamId / env）。
- 表格输出：slug / name / skillsCount / installs / visibility / updatedAt。
- `--json` 输出原始 `PageResult<SuiteListItem>`。

#### suite info

- 调 `GET /api/teams/{teamId}/suites/by-slug/{slug}`。
- 输出：套件元信息（name / visibility / installs / 更新时间）+ skills 表格（position / slug / name / version / installs）。

#### suite install

- 流程：
  1. 调 `GET /api/teams/{teamId}/suites/by-slug/{slug}` 拿到 `SuiteDetail.skills[]`。
  2. 按 `position` 顺序遍历，对每条 skill 走和单 skill `install` 完全一致的流程（§install）：相同的 `--agent` / `--scope` / `--dir` / `--force`。
  3. 每条 skill 在 lockfile 写入时附带 `via: { suite: "<teamId>/<suite-slug>", suiteId: <id> }` 元数据。
  4. 全部走完后调 `POST /api/suites/{id}/install` 做套件计数（失败仅 warn）。
- 默认 best-effort，单条失败继续：
  - 收集每条 skill 的结果。
  - 全部跑完后打印 success / failed 表格。
  - 有任何失败 → 退出码 2；全部成功 → 0。
- `--no-continue-on-error` 切换为 fail-fast：遇错立即停止，已装的不回滚。
- 单条 skill 已存在但没传 `--force` 时，按"用户错"计入 failed，给出可操作提示（建议加 `--force` 或先 `smskill remove`）。
- 套件内每条 skill 的版本来自后端 `SkillInSuite.version`（当前版本快照）。v1 不提供"按套件 pin 历史版本"能力。

输出示例：

```
Installing suite 1/onboarding-pack (4 skills)
  ✓ code-reviewer@2.1.0 → ~/.claude/skills/code-reviewer
  ✓ weather-helper@1.2.0 → ~/.claude/skills/weather-helper
  ✖ legacy-lint@0.3.0   skipped: already installed (use --force)
  ✓ pr-summarizer@1.0.1 → ~/.claude/skills/pr-summarizer

Summary: 3 installed, 1 failed (exit 2)
```

### 5.3 错误提示模板

未配置 token：

```
✖ Missing token. Set it via env or config:
    export SMSKILL_TOKEN=lst_xxxxxxxx
  or:
    smskill config set token lst_xxxxxxxx
  Config file: ~/.smskill/config.json
  Get a token at: <apiBaseUrl>/team/<teamId>/settings/tokens
```

baseUrl 不可达：

```
✖ Cannot reach SkillStack at https://your.server
  Check: smskill config get apiBaseUrl
```

服务端 401：

```
✖ Token rejected by server (40110). It may be revoked or for another instance.
```

## 6. 配置 & 持久化

### 6.1 文件位置

```
~/.smskill/                   # 目录 mode 0700
├── config.json               # mode 0600，配置项见 §6.2
└── installed.json            # mode 0600，中心 lockfile，见 §8
```

### 6.2 Schema

```jsonc
{
  "apiBaseUrl": "http://localhost:8080",   // 可选；缺省时回落到内置默认 http://localhost:8080
  "token": "lst_xxx...",                    // 可选；公共广场操作无需
  "defaultTeamId": 1,                       // 可选；用于错误提示中拼出 token 管理链接
  "defaultAgent": "claude",                 // 可选；claude | codex | openclaw | generic
  "defaultScope": "user"                    // 可选；user | project
}
```

CLI 不会主动写入空字段；缺省字段在读取时回退到内置 fallback 或环境变量。

### 6.3 环境变量

```
SMSKILL_API_BASE_URL
SMSKILL_TOKEN
SMSKILL_TEAM_ID
SMSKILL_AGENT
SMSKILL_SCOPE
```

优先级：**环境变量 > 配置文件 > 内置默认（apiBaseUrl=http://localhost:8080；agent=claude；scope=user）**。token 与 teamId 无内置默认，缺失即视为未配置。

### 6.4 自动探测 cwd（不在 v1 范围）

调研时评估过"看 cwd 里有没有 `.claude/` / `.codex/` / `.openclaw/` 自动选 project + agent"的方案，对 zero-config 体验有吸引力。但有歧义场景（同时存在 `.claude/` 和 `.codex/`）和误判风险（路径里恰好有个同名目录但不是 agent 仓库）。本期保持显式 flag/config 驱动，等积累更多用户反馈再决定是否加。

## 7. 源码分层

```
cli/
├── package.json                 # name: "smskill", bin: { "smskill": "dist/cli.js" }
├── tsconfig.json
├── README.md
├── src/
│   ├── cli.ts                   # commander 入口；全局选项；异常 → 退出码
│   ├── commands/
│   │   ├── config.ts            # 含 set/get/unset/path/check 子命令
│   │   ├── search.ts
│   │   ├── info.ts
│   │   ├── install.ts
│   │   ├── list.ts
│   │   ├── remove.ts
│   │   └── suite.ts             # 含 list / info / install 子命令
│   ├── core/
│   │   ├── api.ts               # axios 客户端；拦截 ApiResponse envelope
│   │   ├── config.ts            # 读 / 写 ~/.smskill/config.json + env 合并
│   │   ├── target.ts            # agent/scope/--dir → install_path 解析（§5.1 矩阵）
│   │   ├── lockfile.ts          # ~/.smskill/installed.json 读 / 写
│   │   ├── install.ts           # 下载 + 顶层目录 strip + 安全解压
│   │   ├── skillRef.ts          # 解析 "slug[@version]"
│   │   ├── suiteRef.ts          # 解析 "<teamId>/<suite-slug>" / "<suite-slug>"
│   │   └── errors.ts            # 业务错误类 + 退出码映射
│   ├── types/
│   │   └── api.ts               # ApiResponse / PageResult / SkillCard / SkillDetail 镜像
│   └── render/
│       ├── table.ts             # cli-table3 包装
│       └── log.ts               # chalk + ora 包装
└── test/
    ├── core/                    # vitest 单测：config / lockfile / install / skillRef
    └── commands/                # 命令层 happy path
```

### 7.1 依赖

运行时：`commander` `axios` `zod` `chalk` `ora` `cli-table3` `adm-zip`（或 `yauzl`，用 yauzl 更安全可控）。

开发时：`typescript` `tsx` `vitest` `@types/node` `@types/adm-zip`（若选 adm-zip）。

不使用 `inquirer`：v1 命令面没有交互式输入，全部用参数 / env 驱动。

### 7.2 与 frontend / backend 的边界

- 不引入 npm workspaces。`cli/` 完全独立的 `package.json` 与 `node_modules`，避免拖慢 frontend 安装。
- 不复用 frontend 的 TS 类型；`cli/src/types/api.ts` 重写后端 DTO 的精简镜像。后端 DTO 字段变更时手动同步。
- 不接入 `scripts/services.sh`；CLI 是终端工具，不属于本地服务编排范畴。

### 7.3 构建 & 运行

普通用户安装：

```
npm install -g smskill
smskill --version
```

本仓库开发当前工作区版本：

```
cd cli
npm install
npm run build         # tsup or tsc → dist/
npm link              # 仅本地开发 link 当前工作区版本
smskill --version
```

`npm run dev` 用 `tsx watch src/cli.ts -- <args>` 直接跑 TS 源码。

> 当前实现补充（2026-05-28）：`smskill@0.1.1` 已发布到 npm 官方 registry，并作为 `latest` 分发。普通用户安装优先使用 `npm install -g smskill` 或 `npx smskill@latest`；`npm link` 仅作为本仓库开发当前工作区版本的方式。

## 8. Lockfile schema

文件：`~/.smskill/installed.json`（**中心 lockfile**，所有 agent / scope / 路径共用一份）

```jsonc
{
  "version": 1,
  "entries": [
    {
      "slug": "weather-helper",
      "name": "Weather Helper",
      "version": "1.2.0",
      "agent": "claude",
      "scope": "user",
      "path": "/Users/yoqu/.claude/skills/weather-helper",
      "source": "skillstack",
      "apiBaseUrl": "https://your.server",
      "downloadPath": "/api/skills/weather-helper/download?version=1.2.0",
      "installedAt": "2026-05-22T03:11:08Z",
      "via": {                            // 仅当通过 suite install 安装时出现
        "suite": "1/onboarding-pack",
        "suiteId": 42
      }
    }
  ]
}
```

**结构选择理由**：

- 用数组而非 `{ slug: entry }` map，因为同一个 slug 可以同时存在于多 agent/scope（例如 user-claude 一份 + project-codex 一份），key 必须是组合键。
- 中心 lockfile 而非按目录散落：agent 目录（如 `~/.claude/skills/`）是 agent 自己的领地，往里塞 `.skills_store_lock.json` 不礼貌；也避免 project scope 时 lockfile 被无意识 commit。
- `path` 是绝对路径快照；用户用 `mv` 搬过后 `list` 会标 `[missing]`，由用户主动 `remove` 清理。
- `version` 是 lockfile schema 版本号，未来不兼容时升 2 + 迁移。
- `source` 固定 `skillstack`，为未来潜在的多源做预留，v1 不实现多源逻辑。

**唯一约束**：`(slug, agent, scope, path)` 四元组唯一。再次 install 相同组合按 `--force` 语义覆盖。

**并发**：v1 通过"读 → 修改 → tmp 写 → rename"原子重写防止文件损坏；不引入 OS 文件锁。两个并发 install 在最差情况下后者覆盖前者的写入，下一次 `list` 会以磁盘为准重建提示（缺失项 + 实际目录），不会永久丢数据。

## 9. 分发

当前状态（2026-05-28）：

- `smskill@0.1.1` 已发布到 npm 官方 registry，并作为 `latest` 分发。
- 普通用户安装入口：`npm install -g smskill`。
- 临时运行入口：`npx smskill@latest`。
- 仓库内 `npm link` / `cli/install.sh` 仅用于本地开发 link 与安装 `skillstack-installer` chat skill。

仍不在 v1 范围：

- 二进制打包（pkg / nexe）。

## 10. 安全

- `~/.smskill/config.json` 与 `~/.smskill/installed.json` 写入时 `chmod 0600`，目录 `chmod 0700`。
- `config get` 默认掩码 token；提供 `--show` 显式打印（明示风险）。
- 解压前对每个 zip entry 做 `path.resolve(install_path, entry).startsWith(install_path + path.sep)` 校验，防 zip-slip。
- 解压目标必须以 `~/.claude/skills/`、`~/.codex/skills/`、`~/.openclaw/skills/`、`~/.smskill/skills/`、`<cwd>/.claude/skills/`、`<cwd>/.codex/skills/`、`<cwd>/skills/` 之一为前缀（或用户显式 `--dir`），避免误装到系统目录。
- 不记录 token 到日志、不上报任何外部 telemetry。
- CLI 不强制 `https://`（私有化部署普遍走内网 http），但 `config check` 命中 `http://` 时输出一条 warn，不阻塞。

## 11. 文档维护

实现完成时同步更新：

- `AGENT.md` 在"主要目录"列表中加入 `cli/`，在"技术栈"补充 Node + TS。
- 顶层 `README.md`（如存在）补一段 CLI 介绍。
- `cli/README.md` 写完整命令手册。
- `docs/superpowers/specs/2026-05-22-smskill-cli-design.md`（本文）保持为方案"原始版本"；后续变更走新的 design doc，不改本文。

## 12. 风险与开放点

- **PAT 路径白名单是窄面**：当前只放下载相关，未来若 CLI 要扩功能（例如 `whoami`、列团队成员），都需要回到 `JwtAuthFilter.isPatAllowedPath` 加白名单。v1 范围内只补 `/versions`（§4.3）。
- **下载体积**：现有 `SkillDownloadService` 是 in-memory 拼装 zip，超大 skill（>50MB）会爆内存。v1 不动，但实现期间需要在 CLI 侧加超时（默认 30s）与体积上限（默认 64MB），超过则报错引导联系管理员。
- **零团队用户**：还没加入任何团队的账号无法生成 PAT，只能匿名访问公共广场。`config set token` 之前的引导文案需要明确说明。
- **私有化部署的 CORS / TLS**：CLI 走的是直连后端，不经 frontend dev proxy，所以不受 CORS 影响；但自签证书场景需要用户自行配置 `NODE_EXTRA_CA_CERTS`，文档中提示。
- **lockfile 锁竞争**：中心 lockfile 并发写时通过 tmp + rename 原子重写缓解；不引入文件锁。详见 §8。
- **agent 路径漂移**：Claude Code / Codex / OpenClaw 任何一家未来改 skill 目录约定（例如 `~/.claude/skills/` 改名），CLI 的 `target.ts` 矩阵需要跟进。本期通过把矩阵单独抽到 `target.ts` 避免散落，路径常量集中改一处。
- **顶层目录剥离假设**：当前实现假定 `SkillDownloadService` 输出 `<slug>-<version>/SKILL.md` 形态。若后端切换到从对象存储拉流（spec §12 已提）且 zip 结构变化，CLI 的 strip 逻辑需要重新评估。实现期间在 `install.ts` 加 sanity check：strip 后必须能看到 `SKILL.md`，否则报错给用户。
- **Suite 版本漂移**：suite 内每条 skill 的 version 取自后端"当前版本快照"——同一套件在不同时间安装可能拉到不同版本组合。v1 接受这种动态语义；如需"固定版本组合"，未来需要后端引入 suite version pin。文档里要说清楚。
- **Suite 安装的非原子性**：best-effort 模式下，若 4 条 skill 失败 1 条，lockfile 留下 3 条记录 + 1 条失败报告。用户应通过 `smskill remove` + 重跑解决，而不是期待 CLI 自动回滚。`--no-continue-on-error` 提供 fail-fast 但同样不回滚。

## 13. 实施计划纲要

后续 `superpowers:writing-plans` 阶段拆出的工作流，预计三个独立工作单元：

1. **后端 PAT 白名单补丁**：§4.3 整改 `isPatAllowedPath`（补 skill `/versions` + 加 suite 三条），加 5 条 `JwtAuthFilterPatTest` 用例。
2. **CLI 骨架 + skill 核心命令**：`cli/` 工程初始化 + `core/target.ts` + `core/lockfile.ts` + config / config check / search / info / install / list / remove。
3. **CLI suite 命令**：`commands/suite.ts` + `core/suiteRef.ts`，复用 `core/install.ts`。依赖 `#1`（白名单）与 `#2`（install 核心）。
4. **文档与 npm 分发**：`cli/README.md`（含 npm 安装、agent 适配矩阵 + suite 示例）、`AGENT.md` 更新、npm registry 安装验证清单（建议覆盖三种 agent + user/project 至少 4 个组合的 smoke，加一条 suite install smoke）。

依赖关系：`#1`、`#2` 可并行；`#3` 依赖 `#1` 合入与 `#2` 的 install 核心模块；`#4` 收尾。
