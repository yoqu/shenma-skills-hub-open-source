#!/usr/bin/env bash
# SkillStack local-development CLI link + chat-install skill installer.
#
# 用法:
#   ./install.sh                       # 全部：构建并 link 当前工作区 smskill + 装 skill 到 ~/.claude/skills/
#   ./install.sh --skill-only          # 只把 SKILL.md 拷到 ~/.claude/skills/skillstack-installer/
#   ./install.sh --cli-only            # 只构建 + link 当前工作区 smskill，不动 Claude skills 目录
#   ./install.sh --skill-scope project # 把 skill 装到当前目录的 ./.claude/skills/ 而不是 ~/.claude/skills/
#   ./install.sh --api-url <url>       # 顺便写入 apiBaseUrl
#   ./install.sh --token <lst_xxx>     # 顺便写入 token
#   ./install.sh --team <id>           # 顺便写入 defaultTeamId
#
# 普通用户安装 CLI 请使用:
#   npm install -g smskill

set -euo pipefail

MODE="all"
SKILL_SCOPE="user"
API_URL=""
TOKEN=""
TEAM_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cli-only)   MODE="cli";    shift ;;
    --skill-only) MODE="skill";  shift ;;
    --skill-scope)
      SKILL_SCOPE="${2:-}"
      if [[ "${SKILL_SCOPE}" != "user" && "${SKILL_SCOPE}" != "project" ]]; then
        echo "Error: --skill-scope must be user or project" >&2
        exit 1
      fi
      shift 2
      ;;
    --api-url)    API_URL="${2:-}";  shift 2 ;;
    --token)      TOKEN="${2:-}";    shift 2 ;;
    --team)       TEAM_ID="${2:-}";  shift 2 ;;
    -h|--help)
      sed -n '2,15p' "$0"
      exit 0
      ;;
    *)
      echo "Error: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="${SCRIPT_DIR}"
SKILL_SRC="${CLI_DIR}/skill/SKILL.md"

if [[ "${SKILL_SCOPE}" == "user" ]]; then
  SKILL_TARGET_DIR="${HOME}/.claude/skills/skillstack-installer"
else
  SKILL_TARGET_DIR="$(pwd)/.claude/skills/skillstack-installer"
fi

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "Error: node is required (>= 20)" >&2
    exit 1
  fi
  local major
  major=$(node -p "process.versions.node.split('.')[0]")
  if (( major < 20 )); then
    echo "Error: node >= 20 required, found $(node -v)" >&2
    exit 1
  fi
}

build_cli() {
  require_node
  echo "[1/3] installing CLI deps in ${CLI_DIR}"
  (cd "${CLI_DIR}" && npm install --no-audit --no-fund)
  echo "[2/3] building smskill"
  (cd "${CLI_DIR}" && npm run build)
  echo "[3/3] linking workspace smskill globally"
  (cd "${CLI_DIR}" && npm link >/dev/null 2>&1) || {
    echo "Warn: npm link failed (need sudo?). Falling back to PATH hint." >&2
    echo "  → manually: export PATH=\"${CLI_DIR}/node_modules/.bin:\$PATH\"" >&2
  }
  if command -v smskill >/dev/null 2>&1; then
    echo "  smskill -> $(command -v smskill)"
  fi
}

apply_config() {
  command -v smskill >/dev/null 2>&1 || return 0
  if [[ -n "${API_URL}" ]]; then
    smskill config set apiBaseUrl "${API_URL}"
  fi
  if [[ -n "${TOKEN}" ]]; then
    smskill config set token "${TOKEN}"
  fi
  if [[ -n "${TEAM_ID}" ]]; then
    smskill config set defaultTeamId "${TEAM_ID}"
  fi
}

install_skill() {
  if [[ ! -f "${SKILL_SRC}" ]]; then
    echo "Error: ${SKILL_SRC} missing" >&2
    exit 1
  fi
  mkdir -p "${SKILL_TARGET_DIR}"
  cp "${SKILL_SRC}" "${SKILL_TARGET_DIR}/SKILL.md"
  echo "  installed skillstack-installer skill → ${SKILL_TARGET_DIR}/SKILL.md"
}

case "${MODE}" in
  cli)
    build_cli
    apply_config
    ;;
  skill)
    install_skill
    ;;
  all)
    build_cli
    apply_config
    install_skill
    ;;
esac

cat <<DONE

✓ done.

下一步:
  1) 如果是第一次，配一下平台地址和 token（已经传 --api-url / --token 的可跳过）:
       smskill config set apiBaseUrl http://localhost:8080
       smskill config set token lst_xxxxxxxx        # Web 端 → 团队设置 → 个人令牌
       smskill config set defaultTeamId 1
  2) 验通:
       smskill config check
  3) 在 Claude Code 里说一句 "帮我装 hello-cli"，应自动走 skillstack-installer skill。

skill 位置: ${SKILL_TARGET_DIR}/SKILL.md
DONE
