---
name: smskill-cli
description: 使用 SkillStack CLI smskill 搜索、查看、上传、安装、列出、移除 skill，并管理 suite。MUST trigger when 用户要求使用 smskill、SkillStack CLI、上传 skill、安装 skill、查看 skill 信息、配置 SkillStack CLI 或管理 suite。
version: 0.2.0
category: dev
tags:
  - cli
  - skillstack
  - smskill
langs:
  - TypeScript
---

# smskill CLI

`smskill` 是 SkillStack 的终端客户端，用于把团队 SkillStack 平台里的 skill 和 suite 接入本地 Agent 工作区。它支持配置服务地址与 token、搜索公共 skill、查看详情、上传 `SKILL.md`、安装到一个或多个 Agent、列出和移除本地安装记录，以及安装 suite。

安装时真实内容只存一份在 `~/.agents/skills/<slug>/`，被选中的 Agent（Claude / Codex）在各自的 skills 目录下以**软链**指向它，避免多份拷贝、便于统一更新。安装目标可以交互式多选（↑↓ 移动、空格选择），也可以用 `-y` 一键装到全部受支持的 Agent。

## 前置检查

如果本机还没有 CLI，先安装 npm 包：

```bash
npm install -g smskill
```

也可以不全局安装，临时使用：

```bash
npx smskill@latest --version
```

每次首次使用先确认 CLI 和配置：

```bash
smskill --version
smskill config get apiBaseUrl
smskill config get token
smskill config get defaultTeamId
smskill config check
```

`config check` 会访问 `/api/skills`，并在有 token 时抽样访问 skill 详情验证凭据。上传 skill 需要完整登录 JWT；搜索、查看、安装和 suite 消费路径可使用 `lst_` 开头的 Personal Access Token。

## 配置命令

```bash
smskill config set apiBaseUrl http://localhost:8080
smskill config set token <jwt-or-lst-token>
smskill config set defaultTeamId 1
smskill config set defaultAgent codex
smskill config set defaultScope user

smskill config get
smskill config get token
smskill config get token --show
smskill config unset token
smskill config path
smskill config check
```

也可以用环境变量临时覆盖：

```bash
SMSKILL_API_BASE_URL=http://localhost:8080 \
SMSKILL_TOKEN=<token> \
SMSKILL_TEAM_ID=1 \
smskill search cli
```

## 搜索 skill

```bash
smskill search
smskill search code format
smskill search markdown --limit 5
smskill search deploy --json
```

输出表格中的 `slug` 是 `info`、`install`、`remove` 等命令使用的引用。

## 查看 skill 详情

```bash
smskill info mono-format
smskill info mono-format@2.4.1
```

`info` 会展示 skill 基本信息和最近版本。带 `@version` 时只解析 slug；版本列表仍由服务端返回。

## 上传 skill

上传当前目录的 `SKILL.md`：

```bash
smskill upload docs/skills/smskill-cli --team 1 --cat dev --visibility TEAM_PRIVATE
```

上传单个 markdown 文件并覆盖元数据：

```bash
smskill upload docs/skills/smskill-cli/SKILL.md \
  --team 1 \
  --name "smskill CLI" \
  --slug smskill-cli \
  --desc "SkillStack CLI 使用说明" \
  --version 0.2.0 \
  --tag cli \
  --tag skillstack \
  --lang typescript
```

保存草稿而不是提交审核：

```bash
smskill upload docs/skills/smskill-cli --team 1 --draft
```

元数据来源优先级：命令行参数 > 服务端解析结果 > `SKILL.md` frontmatter > 默认值。上传命令会调用 `upload-text`、`parse`、`create` 三个后端接口；如果团队启用审核流，输出会包含 `reviewId`，发布前不能被安装。

## 安装 skill

```bash
# 不带 --agent 且在交互终端里：弹出多选，↑↓ 移动、空格勾选、回车确认
smskill install mono-format

smskill install mono-format@2.4.1
smskill install mono-format --force

# -y / --yes：跳过询问，直接装到全部受支持的 agent（claude + codex）
smskill install mono-format -y

# --agent 显式指定，逗号分隔可多选；指定后不再询问
smskill install mono-format --agent codex
smskill install mono-format --agent claude,codex --scope user
smskill install mono-format --agent claude --scope project

# --dir 直装到任意目录：真实解压、不建软链（适合临时目标 / CI）
smskill install mono-format --dir /tmp/smskill-target
```

agent 选择优先级：`--dir` > `--agent` > `-y` > 交互式多选 > 非交互回退到 `defaultAgent`。
默认 scope 来自配置 `defaultScope`（默认 `user`）。

### 落地结构（软链模式）

真实内容统一放在一个 store，各 agent 软链进去：

| scope | 内容 store（真实文件） | agent 软链 |
|---|---|---|
| `user` | `~/.agents/skills/<slug>/` | `~/.claude/skills/<slug>` · `~/.codex/skills/<slug>` |
| `project` | `<cwd>/.agents/skills/<slug>/` | `<cwd>/.claude/skills/<slug>` · `<cwd>/.codex/skills/<slug>` |

`--dir <path>` 是例外：直接把内容真实解压到 `<path>/<slug>/`，不进 store、不建软链。

交互式多选当前只暴露 `claude` 和 `codex`；`--agent` 仍兼容 `openclaw` / `generic`（单 agent 显式安装）。

## 列出与移除本地安装

```bash
smskill list
smskill list --agent codex
smskill list --scope project
smskill list --suite 1/onboard

smskill remove mono-format
smskill remove mono-format --agent codex
smskill remove mono-format --agent codex --scope user
```

`list` 读取 `~/.smskill/installed.json`；软链模式下每个 agent 是一条记录。`remove` 删除对应 agent 的软链并移除 lockfile 记录；当某个 store 不再被任何 agent 引用时，会顺带回收 `~/.agents/skills/<slug>/` 真实内容。如果同名 skill 有多处安装，需要用 `--agent` / `--scope` 缩小范围。

## suite 命令

```bash
smskill suite list
smskill suite list --team 1
smskill suite list --team 1 --limit 5
smskill suite list --team 1 --json

smskill suite info 1/onboard
smskill suite info onboard

smskill suite install 1/onboard
smskill suite install onboard --agent codex --scope user
smskill suite install 1/onboard --force
smskill suite install 1/onboard --no-continue-on-error
```

`suite info/install` 的引用格式是 `<teamId>/<suiteSlug>`；如果只传 slug，必须先设置 `defaultTeamId`。

## 常见问题

- `teamId required`：传 `--team <id>` 或先 `smskill config set defaultTeamId <id>`。
- `token required`：上传、私有 skill 或团队 suite 需要 `smskill config set token <token>`。
- `server error 40300: PAT 仅可用于...`：当前命令需要完整 JWT，不能使用 `lst_` PAT。
- `install path already exists`：加 `--force` 覆盖，或先 `smskill remove <slug>`。
- `server rejected skill package`：服务端解析 `SKILL.md` 未通过，先修正 frontmatter 或内容结构。
- 网络错误：先检查 `smskill config get apiBaseUrl` 和 `smskill config check`。
