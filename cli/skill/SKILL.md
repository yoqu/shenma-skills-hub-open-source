---
name: skillstack-installer
description: 通过对话调用 SkillStack 平台，搜索、查看、安装 skill 与 suite。MUST trigger when 用户说"找/搜/装 skill"、"install skill"、"安装套件"、"smskill"、提到 skill slug、或要求查看 skill 信息。
version: 0.1.1
category: dev
tags:
  - cli
  - skillstack
  - installer
langs:
  - TypeScript
---

# SkillStack Installer

把对话变成一条 `smskill` 命令，帮用户在 SkillStack 平台上找 skill、看 skill、上传 skill、装 skill 与 suite。

## 触发规则

满足任意一条就走这个 skill：

- 出现关键词：`找 skill`、`搜 skill`、`装 skill`、`安装 skill`、`上传 skill`、`upload skill`、`install skill`、`smskill`、`安装套件`、`install suite`、`找套件`
- 用户给了一个明显的 skill slug（例如 `hello-cli`、`mono-format`），或给了 suite 引用（`<teamId>/<slug>`，比如 `1/onboard`）
- 用户问 "这个 skill 怎么用 / 装好了吗 / 列一下我装了哪些 skill"

不要替用户搜外网 npm / GitHub —— skill 都在 SkillStack 平台上。

## 前置检查（每次会话第一次使用时跑一遍）

1. 确认 CLI 可用：

   ```bash
   smskill --version
   ```

   若提示 command not found，跳到「安装 CLI」一节，优先让用户安装 npm 包；只有开发当前仓库版本或需要安装本 chat skill 时，才使用 `install.sh`。

2. 确认配置已就绪：

   ```bash
   smskill config get apiBaseUrl
   smskill config get token
   ```

   两者必须非空。若缺：

   - `apiBaseUrl`：问用户 SkillStack 部署地址（公司内网或本地 `http://localhost:8080`），再跑 `smskill config set apiBaseUrl <url>`
   - `token`：让用户去 Web 端 → 团队设置 → 个人令牌 生成一个 `lst_...`，再 `smskill config set token <lst_...>`
   - 团队 id：很多命令默认从 `defaultTeamId` 取，若需要也一并 `smskill config set defaultTeamId <id>`

3. 跑一次连通性自检：

   ```bash
   smskill config check
   ```

   `token OK` 才算可用。

## 主要工作流

### 搜索 skill

```bash
smskill search <keyword>
```

- 不带关键字会列出全部已发布 skill（最近上架排前）。
- 输出中 `slug` 列就是后面装 skill 时要传的引用。
- 想要原始 JSON 加 `--json`。

### 查看单个 skill 详情

```bash
smskill info <slug>
```

- 默认展示当前 version、team、可见性、安全等级、近 5 个版本。
- 若用户问"它是干啥的"，从 `shortDesc` + 第一段说明回答即可。

### 安装 skill

```bash
smskill install <slug>                # 默认 agent=claude, scope=user
smskill install <slug> --scope project
smskill install <slug>@<version>      # 钉到具体版本
smskill install <slug> --agent codex  # 装到 ~/.codex/skills/<slug>/
smskill install <slug> --agent openclaw --scope project  # ./skills/<slug>/
```

落盘路径对照：

| agent | scope=user | scope=project |
|---|---|---|
| claude | `~/.claude/skills/<slug>/` | `<cwd>/.claude/skills/<slug>/` |
| codex | `~/.codex/skills/<slug>/` | `<cwd>/.codex/skills/<slug>/` |
| openclaw | `~/.openclaw/skills/<slug>/` | `<cwd>/skills/<slug>/` |
| generic | `~/.smskill/skills/<slug>/` | `<cwd>/skills/<slug>/` |

跑 install 之前先用 `info` 确认版本、可见性、安全状态；如果安全等级是 `warn` 或 `fail`，向用户复述并征求确认再装。

### 上传 skill

上传需要完整登录 JWT；`lst_` Personal Access Token 只能用于查询和安装，不能创建 skill。

```bash
smskill upload path/to/SKILL.md --team <teamId> --cat dev --visibility TEAM_PRIVATE
smskill upload path/to/skill-dir --team <teamId> --name "Skill 名称" --slug skill-slug
smskill upload path/to/SKILL.md --team <teamId> --draft
```

如果用户没有传 `--team`，先确认 `smskill config get defaultTeamId` 是否已设置。上传后若输出 `pending review`，说明需要管理员审核后才能安装。

### 装套件（suite）

套件引用是 `<teamId>/<slug>`，不是 `<team-slug>/<slug>`。

```bash
smskill suite list                     # 用 defaultTeamId 列套件
smskill suite list --team <teamId>     # 指定团队
smskill suite info 1/onboard
smskill suite install 1/onboard
smskill suite install onboard          # 走 defaultTeamId
smskill suite install 1/onboard --no-continue-on-error
```

默认 best-effort 安装；若用户强调"全部成功否则别动"，加 `--no-continue-on-error`。

### 查看 / 删除已装的 skill

```bash
smskill list
smskill list --agent claude
smskill list --suite 1/onboard
smskill remove <slug>
smskill remove <slug> --agent claude
```

`remove` 不带 `--agent` 会移除 lockfile 中所有 agent 下的同名 skill 安装；不确定就先 `list` 一下再问用户。

## 报告模板

每次完成一次"装"，给用户简短回执，至少含：

- 装了什么（slug + 版本）
- 装到哪里（绝对路径，从 CLI 输出里抄）
- 来源（哪个 team / 可见性）
- 下一步建议：`smskill list` 或 `smskill info <slug>` 看详情

不要自己编造路径或版本；都从命令输出里取。

## 异常处理

- `server error 40110: 登录已失效`：token 失效或被撤销，引导用户重新生成 PAT。
- `server error 40300: PAT 仅可用于...`：用户给的 token 是 JWT 不是 PAT，提示改用 `lst_` 开头的个人令牌。
- `install path already exists`：让用户加 `--force` 覆盖，或先 `smskill remove <slug>` 再装。
- 网络错误：先 `smskill config check`，看 `apiBaseUrl` 是否可达。

## 安装 CLI（仅在 smskill 不可用时）

如果 `smskill --version` 不识别：

```bash
npm install -g smskill
smskill --version
```

临时运行可用：

```bash
npx smskill@latest --version
```

如果你正在开发 SkillStack 仓库内的 CLI，或需要把当前 skill 复制到 `~/.claude/skills/skillstack-installer/`，再使用本地脚本：

```bash
cd cli
./install.sh
```

`install.sh` 会构建并 link 当前工作区版本，同时安装 `skillstack-installer` chat skill。普通用户不需要走这条路径。
