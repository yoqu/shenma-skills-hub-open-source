# smskill

SkillStack terminal client. See `docs/superpowers/specs/2026-05-22-smskill-cli-design.md` for the design.

## Install

用户安装推荐直接使用 npm 官方仓库：

```bash
npm install -g smskill
smskill --version
```

不想全局安装时，也可以直接临时运行：

```bash
npx smskill@latest --version
```

要求 Node.js 20+。当前 npm 包名是 `smskill`，bin 命令也是 `smskill`。

## Local Development

仓库内一键脚本用于本地开发 link，并可顺便把 `skillstack-installer` chat-install skill 部署到 Claude Code：

```bash
cd cli
./install.sh
# 可选: ./install.sh --api-url http://localhost:8080 --token lst_xxx --team 1
```

`install.sh` 会：

1. `npm install` + `npm run build` + `npm link`，把当前工作区版本 link 为全局 `smskill`。
2. 把 `cli/skill/SKILL.md` 拷到 `~/.claude/skills/skillstack-installer/`，让 Claude Code 在对话里识别 `"帮我装 X"`、`"smskill"`、`"找/装套件"` 等触发词。
3. 跑完后引导你 `smskill config set apiBaseUrl <url>` 和 `smskill config set token lst_...`。

Flags:

- `--cli-only`：只构建 + link 本地 CLI，不动 `~/.claude/skills/`
- `--skill-only`：只更新 SKILL.md
- `--skill-scope project`：把 skill 写到当前目录的 `./.claude/skills/skillstack-installer/` 而不是用户目录

手动本地开发等同：

```bash
cd cli
npm install
npm run build
npm link        # link current workspace for local development
cp skill/SKILL.md ~/.claude/skills/skillstack-installer/SKILL.md
```

## Configure

可以用网页登录或粘贴 token 的方式保存登录态：

```bash
smskill login --api https://your.server --web
smskill login --api https://your.server --paste
smskill whoami
smskill logout
```

也可以手动配置：

```bash
smskill config set apiBaseUrl https://your.server
smskill config set token lst_xxxxxxxx
smskill config set defaultTeamId 1
smskill config check
```

Or use env vars (CI-friendly):

```bash
export SMSKILL_API_BASE_URL=https://your.server
export SMSKILL_TOKEN=lst_xxxxxxxx
export SMSKILL_TEAM_ID=1
```

## Browse skills

```bash
smskill search weather
smskill search code format --limit 5
smskill search deploy --json
smskill info weather-helper
smskill info weather-helper@1.2.0
```

## Install a skill

```bash
smskill install weather-helper                       # → ~/.claude/skills/weather-helper/
smskill install weather-helper --scope project       # → ./.claude/skills/weather-helper/
smskill install weather-helper --agent codex         # → ~/.codex/skills/weather-helper/
smskill install weather-helper --agent openclaw --scope project   # → ./skills/weather-helper/
```

| agent | scope=user | scope=project |
|---|---|---|
| claude | `~/.claude/skills/<slug>/` | `<cwd>/.claude/skills/<slug>/` |
| codex | `~/.codex/skills/<slug>/` | `<cwd>/.codex/skills/<slug>/` |
| openclaw | `~/.openclaw/skills/<slug>/` | `<cwd>/skills/<slug>/` |
| generic | `~/.smskill/skills/<slug>/` | `<cwd>/skills/<slug>/` |

## Prompt commands

```bash
smskill prompt search review
smskill prompt info 1/review-context
smskill prompt get 1/review-context
smskill prompt get 1/review-context --out ./review-context.md --force
smskill prompt get 1/review-context --raw
```

Prompt 默认导出到 `~/.smskill/prompts/<team>/<slug>.md`，也可以用 `--out` 或 `--prompts-dir` 改写落盘位置。

## Install a suite

```bash
smskill suite list
smskill suite info 1/onboarding-pack
smskill suite install 1/onboarding-pack              # best-effort; failed skills don't roll back
smskill suite install onboarding-pack --no-continue-on-error
```

Suite 可以同时包含 skill 和 prompt；`suite install` 会安装 skill，并导出 prompt。

## Upload a skill

```bash
smskill upload ./my-skill --team 1 --cat dev --visibility TEAM_PRIVATE
smskill upload ./my-skill/SKILL.md --team 1 --name "My Skill" --slug my-skill
smskill upload ./my-skill --team 1 --draft
```

上传需要完整登录 JWT；搜索、查看、安装和 suite 消费可以使用 `lst_` Personal Access Token。

## Manage installed skills

```bash
smskill list
smskill list --agent claude
smskill list --suite 1/onboarding-pack
smskill remove weather-helper --agent claude
```

## Configuration file

Stored at `~/.smskill/config.json` (mode 0600). Lockfile at `~/.smskill/installed.json`.

## Self-signed TLS

Set `NODE_EXTRA_CA_CERTS=/path/to/ca.pem` before running smskill.
