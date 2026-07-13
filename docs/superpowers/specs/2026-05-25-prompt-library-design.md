# Prompt 提示词库设计

- 日期：2026-05-25
- 状态：Draft
- 范围：Prompt 提示词库、Tiptap Markdown 编辑器、Prompt 引用解析、审核抽象、套件混合资产、CLI Prompt 导出、首页 Prompt tab、评价抽象
- 目标用户：团队成员、团队 OWNER / ADMIN、通过 `smskill` 消费团队资产的终端用户

## 1. 背景

SkillStack 当前核心资产是 Skill，已有创建、审核、版本、套件、下载、评价与公开展示链路。

团队还需要维护可复用的 prompt 提示词库，让成员可以：

1. 在 Web 端用可视化编辑器快速创建和维护提示词。
2. 以 Markdown 格式保存提示词内容。
3. 在提示词内容中 `@` 引用其他提示词，组合出复杂提示词。
4. 像 Skill 一样进入审核队列、加入套件、被评价、被首页/广场发现。
5. 通过 CLI 下载为单独 `.md` 文件，在本地项目或 agent 工作流中直接使用。

本设计采用“新增 Prompt 领域 + 横向能力抽象”的混合方案：

- Prompt 拥有独立数据模型和编辑/版本/引用逻辑。
- 审核、套件、评价、收藏、首页展示、CLI 下载逐步抽象为支持 `SKILL | PROMPT` 的共享能力。
- 不做全量 `assets` 大表重构，避免一次性迁移现有 Skill 主链路。

## 2. 设计目标

1. 提供团队级 Prompt 库，支持内容、标签、分类、版本、可见性、审核状态。
2. 基于 Tiptap 封装 Prompt 编辑器，编辑体验可视化，保存格式仍是 Markdown。
3. Prompt 支持 `@` 引用多个 Prompt，引用永远解析到被引用 Prompt 的最新 `APPROVED` 版本。
4. 审核队列抽象出 `target_type`，让 Skill 和 Prompt 共用状态机与审批操作，详情按类型渲染。
5. 套件支持混合维护 Skill 和 Prompt。
6. CLI 支持单独下载 Prompt 为 `.md`，并在 `suite install` 时默认同时导出套件内 Prompt。
7. 首页/广场增加 Prompt tab，但公共展示仍只暴露 `PUBLIC + APPROVED` 资产。
8. 评价能力抽象为可评价 Skill 和 Prompt。

## 3. 非目标

- 不新增 AI 自动生成提示词能力。
- 不做 Prompt marketplace、MCP 广场或复杂社区推荐。
- 不支持引用历史固定版本；历史版本仅用于查看、diff、审计回溯。
- 不做 Prompt 多人实时协同编辑。
- 不做 Prompt 运行沙箱或模型调用执行器。
- 不把现有 Skill 主表迁移为统一 `assets` 主表。

## 4. 核心决策

### 4.1 Prompt 引用版本策略

Prompt 引用永远解析到被引用 Prompt 的最新 `APPROVED` 版本。

影响：

- `prompt_refs` 不存 `referenced_version`。
- 审核、预览、详情、CLI 导出时动态解析最新审核版本。
- 历史版本页面展示当时保存的 Markdown 原文；若用户选择“展开预览”，仍按当前最新审核版本解析，并明确标注这是当前解析结果。
- 被引用 Prompt 发布新审核版本后，上层 Prompt 的有效展开内容会自动变化。
- 编译缓存必须在任意被引用 Prompt 最新版本变化后失效。

### 4.2 套件与 CLI 行为

混合套件支持 `SKILL` 和 `PROMPT`。

`smskill suite install` 默认同时处理两类资产：

- `SKILL`：沿用现有逻辑，安装到 agent skill 目录。
- `PROMPT`：导出为 `.md` 文件，默认写入 `~/.smskill/prompts/<teamSlug>/<slug>.md`。
- `--prompts-dir <path>`：覆盖 Prompt 导出目录。
- 默认导出展开后的完整 Markdown。
- `--raw`：导出原始 Markdown，保留 `@prompt` 引用标记。

### 4.3 审核抽象策略

不做全量审核系统重写，采用增量抽象：

- `reviews` 增加 `target_type = SKILL | PROMPT`。
- `reviews` 增加 `target_id`、`payload_json`、通用展示字段。
- 现有 Skill 字段保留用于兼容迁移。
- 审核列表共用状态、提交人、提交时间、审批操作。
- 审核详情按 `target_type` 切换渲染 Skill / Prompt 详情。
- approve 时分发到 `SkillReviewMaterializer` / `PromptReviewMaterializer`。

## 5. 领域模型

### 5.1 `prompts`

团队内已发布 Prompt 资产表，只承载 `APPROVED / UNLISTED` 的 Prompt。

| 字段 | 说明 |
|---|---|
| `id` | 主键 |
| `team_id` | 所属团队 |
| `slug` | 团队内唯一 slug，唯一键 `(team_id, slug)` |
| `name` | 展示名称 |
| `short_desc` | 简短描述 |
| `cat_code` | 分类 code |
| `visibility` | `PUBLIC` / `TEAM_PRIVATE` |
| `status` | `APPROVED` / `UNLISTED` |
| `version` | 当前发布版本 |
| `author_id` | 作者 |
| `score` | 评价均分 |
| `stars` | 收藏数 |
| `exports` | CLI / Web 导出次数 |
| `current_version_id` | 当前版本行 |
| `published_at` | 发布时间 |

约束：

- Prompt slug 按团队隔离，不做全局唯一。
- Public 展示必须同时满足 `visibility='PUBLIC'`、`status='APPROVED'`、团队公开主页允许展示。
- `UNLISTED` 可以保留详情访问权限，但不进入首页/广场列表。

### 5.2 `prompt_versions`

Prompt 版本历史表。

| 字段 | 说明 |
|---|---|
| `prompt_id` | Prompt 主键 |
| `version` | 版本号 |
| `content_md` | Markdown 原文 |
| `changelog` | 版本说明 |
| `content_sha256` | 内容摘要，便于审计和缓存 |
| `refs_count` | 引用数量 |
| `published_at` | 版本发布时间 |

约束：

- 唯一键 `(prompt_id, version)`。
- 历史版本不可编辑，只可查看。
- 引用展开不锁定历史版本；历史版本只是内容快照。

### 5.3 `prompt_refs`

Prompt 引用关系表，用于引用图、循环校验、影响面查询和缓存失效。

| 字段 | 说明 |
|---|---|
| `source_prompt_id` | 源 Prompt |
| `source_version_id` | 源 Prompt 版本 |
| `referenced_prompt_id` | 被引用 Prompt |
| `display_label` | Markdown 中显示的 label |
| `position` | 在内容中的出现顺序 |

约束：

- 不存被引用版本。
- approve 时基于待发布内容重建该版本的引用关系。
- 引用解析时总是读取 `referenced_prompt.current_version_id`。

### 5.4 `prompt_tags`

复用现有 `tags` 字典，新增 Prompt 关联表：

```text
prompt_tags(prompt_id, tag_id)
```

不把 `skill_tags` 直接改名，避免影响现有 Skill 查询。后续若确实需要统一标签关联，可再演进为 `asset_tags`。

### 5.5 分类

第一期复用现有 `categories` 字典，但前端展示要允许 Prompt 和 Skill 使用同一分类 code。

后续若 Prompt 分类明显分化，再给 `categories` 增加 `content_type` 或新增 `prompt_categories`，本期不预先扩展。

## 6. Markdown 与 Tiptap 编辑器

### 6.1 编辑器能力

新增 `PromptEditor`，基于 Tiptap 封装：

- Markdown 正文编辑。
- 标题、列表、引用、代码块、分隔线、链接等基础格式。
- `@prompt` Mention 节点。
- 右侧或底部预览展开后的 Markdown。
- 保存草稿、提交审核、查看版本。
- 离开页面时有未保存提示。

### 6.2 `@prompt` Markdown 序列化

编辑器中 `@prompt` 显示为 chip，落库时保存为 Markdown link：

```markdown
@[登录上下文](skillstack://prompt/ludou-fe/login-context)
```

规则：

- scheme 固定为 `skillstack://prompt/`。
- path 使用 `<teamSlug>/<promptSlug>`。
- label 仅用于展示，不作为解析依据。
- 保存时后端解析 link，校验目标 Prompt 存在且当前用户可引用。
- 若目标重命名，详情页可按 `prompt_refs` 做修复提示，但 Markdown 原文不自动重写。

### 6.3 原始内容与展开内容

系统只把 `content_md` 作为事实源。

展开内容由 `PromptResolveService` 动态生成：

```text
content_md
  -> parse prompt links
  -> load latest APPROVED referenced prompt version
  -> recursively expand
  -> output resolved markdown
```

展开策略：

- 默认递归展开。
- 最大深度限制为 10。
- 检测循环引用，返回明确错误路径。
- 引用块之间插入来源注释，便于 CLI 导出后追溯。
- Web 预览可折叠显示引用来源；CLI 默认输出完整 md。

## 7. 审核抽象

### 7.1 `reviews` 扩展

新增列：

| 字段 | 说明 |
|---|---|
| `target_type` | `SKILL` / `PROMPT`，默认 `SKILL` |
| `target_id` | 已物化资产 id，首次创建审核通过前可空 |
| `display_slug` | 通用展示 slug |
| `display_name` | 通用展示名称 |
| `payload_json` | 各类型提交 payload |

Skill 兼容：

- 现有 `skill_id / skill_slug / skill_name / short_desc / cat_code / tags_json / zip_url` 暂时保留。
- backfill：历史 review 写入 `target_type='SKILL'`，`target_id=skill_id`，`display_slug=skill_slug`，`display_name=skill_name`。
- 新 Skill 提交可以继续写旧字段，同时写通用字段；实现稳定后再逐步收敛。

Prompt payload 示例：

```json
{
  "kind": "CREATE",
  "slug": "login-context",
  "name": "登录上下文",
  "shortDesc": "登录类任务通用上下文",
  "cat": "ai",
  "visibility": "TEAM_PRIVATE",
  "version": "0.1.0",
  "tags": ["auth", "agent"],
  "contentMd": "...",
  "changelog": "initial",
  "refs": [
    { "teamSlug": "ludou-fe", "slug": "base-role", "label": "基础角色" }
  ]
}
```

### 7.2 状态机

沿用现有 review-first 状态机：

```text
DRAFT -> PENDING_REVIEW -> APPROVED
                       -> REJECTED
                       -> CHANGES_REQUESTED
                       -> WITHDRAWN
```

Prompt 审核与 Skill 审核共享：

- submitter 编辑草稿、撤回、重新提交。
- OWNER / ADMIN approve、reject、request changes。
- 审核评论、通知、MySubmissions 入口。

### 7.3 Prompt approve 物化

`PromptReviewMaterializer.approve(review)` 在事务内执行：

1. 校验 review 状态和操作者权限。
2. 解析 `payload_json`。
3. 校验 slug 在团队内唯一，且不与活跃 Prompt 审核冲突。
4. 校验 Markdown 中的 prompt refs：
   - 目标存在；
   - 当前用户有读取权限；
   - `PUBLIC` Prompt 不允许引用 `TEAM_PRIVATE` Prompt；
   - 引用图不会产生循环；
   - 引用目标有最新 `APPROVED` 版本。
5. 若 `kind='CREATE'`：
   - 插入 `prompts`；
   - 插入初始 `prompt_versions`；
   - 写 `prompt_tags`；
   - 写 `prompt_refs`；
   - 回填 `reviews.target_id`。
6. 若 `kind='VERSION_BUMP'`：
   - 插入新 `prompt_versions`；
   - 更新 `prompts.version/current_version_id`；
   - 重建该版本 `prompt_refs`。
7. 更新 review 状态为 `APPROVED`。
8. 写 activity、通知提交者、失效相关展开缓存。

拒绝、要求修改、撤回不改变已上线 Prompt 当前版本。

## 8. 套件混合资产

### 8.1 `suite_items` 扩展

新增列：

| 字段 | 说明 |
|---|---|
| `item_type` | `SKILL` / `PROMPT` |
| `item_id` | 对应资产 id |

迁移策略：

1. 新增 `item_type`、`item_id`，允许空。
2. backfill：现有行 `item_type='SKILL'`、`item_id=skill_id`。
3. 新增唯一键 `(suite_id, item_type, item_id)`。
4. 第一阶段保留 `skill_id` 兼容旧代码；新代码读写 `item_type/item_id`。
5. 后续稳定后再删除 `skill_id` 和旧唯一键。

### 8.2 Suite DTO

`SuiteDetail.items` 替代只包含 skill 的 `skills`：

```json
{
  "id": 1,
  "slug": "agent-onboarding",
  "items": [
    { "type": "SKILL", "id": 7, "slug": "ludou-release", "name": "Skill · ludou-release" },
    { "type": "PROMPT", "id": 3, "slug": "code-review-context", "name": "代码评审上下文" }
  ]
}
```

兼容：

- 前端新页面使用 `items`。
- CLI 新版本使用 `items`。
- 旧字段 `skills` 可短期保留为 `items` 中 `SKILL` 的投影，避免旧 CLI 立即失效。

### 8.3 套件编辑 UI

套件编辑器增加资产类型筛选：

- `Skills`
- `Prompts`
- `All`

列表项需要显示类型 badge，避免同名 Skill 和 Prompt 混淆。

## 9. 评价与收藏抽象

### 9.1 新表 `asset_reviews`

替代 Skill 专用 `skill_reviews` 的领域能力。

| 字段 | 说明 |
|---|---|
| `target_type` | `SKILL` / `PROMPT` |
| `target_id` | 资产 id |
| `user_id` | 评价用户 |
| `rating` | 1 到 5 |
| `body` | 评论正文 |
| `version` | 评价时资产版本 |

唯一键：

```text
(target_type, target_id, user_id)
```

迁移：

- 将 `skill_reviews` 历史数据迁到 `asset_reviews(target_type='SKILL')`。
- Skill 详情接口保持 `/api/skills/{id}/reviews`，内部改用 `AssetReviewService`。
- Prompt 详情新增 `/api/prompts/{id}/reviews`，同样使用 `AssetReviewService`。

### 9.2 新表 `asset_review_replies`

替代 `skill_review_replies`。

作者回复权限：

- `SKILL`：沿用 Skill author。
- `PROMPT`：Prompt author。

### 9.3 收藏

如果 Prompt 详情也需要收藏数，新增 `asset_stars`：

```text
asset_stars(target_type, target_id, user_id)
```

Skill `star/unstar` 接口内部迁到通用服务，前端 API 可保持原路径。

## 10. 后端 API

### 10.1 Prompt 公开 / 团队查询

```http
GET /api/prompts
GET /api/teams/{teamId}/prompts
GET /api/teams/{teamSlug}/prompts/{promptSlug}
GET /api/prompts/{id}/versions
GET /api/prompts/{id}/versions/{version}
```

规则：

- `GET /api/prompts` 只返回 `PUBLIC + APPROVED`，用于首页/广场 Prompt tab。
- `GET /api/teams/{teamId}/prompts` 需要团队成员，支持状态、可见性、分类、作者、搜索。
- 详情接口按团队 slug + prompt slug 定位，避免不同团队 prompt slug 冲突。

### 10.2 创建与版本

```http
POST /api/prompts
POST /api/prompts/drafts
POST /api/prompts/{id}/versions
PATCH /api/prompts/{id}/admin-profile
PATCH /api/prompts/{id}/visibility
PATCH /api/prompts/{id}/status
DELETE /api/prompts/{id}
```

发布规则与 Skill 对齐：

- `DIRECT_PUBLISH` 且非草稿：可直接物化为 `APPROVED`。
- `REVIEW_REQUIRED` 或草稿：进入 `reviews(target_type='PROMPT')`。
- 管理员提交新版本可直接发布；普通成员按团队 review mode 分流。

### 10.3 解析与导出

```http
POST /api/prompts/resolve
GET /api/prompts/{id}/download?raw=false
GET /api/teams/{teamSlug}/prompts/{promptSlug}/download?raw=false
```

`raw=false`：

- 返回展开后的 Markdown。
- response filename 为 `<slug>.md`。
- frontmatter 包含实际展开的引用版本。

`raw=true`：

- 返回原始 Markdown。
- 保留 `skillstack://prompt/...` 引用标记。

### 10.4 Review API

现有 review endpoint 保持：

```http
GET /api/teams/{teamId}/reviews?targetType=PROMPT
GET /api/reviews/{id}
POST /api/reviews/{id}/approve
POST /api/reviews/{id}/reject
POST /api/reviews/{id}/request-changes
```

新增 `targetType` 查询参数，不传表示全部类型或保持现有默认全部。

## 11. 前端页面与导航

### 11.1 首页 / 广场

首页增加 Prompt tab：

- `Skills`
- `Prompts`

公共展示边界保持轻量：

- 只展示公开且审核通过资产。
- 搜索优先覆盖名称、slug、简介、标签、分类。
- 不新增复杂推荐、社区动态、个性化排序。

### 11.2 团队工作区

新增团队 Prompt 库：

```text
/team/prompts
```

能力：

- 列表、搜索、分类、标签、状态、可见性筛选。
- 进入详情。
- OWNER / ADMIN 可上下架、改可见性、编辑元信息、删除。
- 作者或成员可提交新版本。

### 11.3 创建 / 编辑

新增：

```text
/create/prompt
/team/prompts/:id/edit
```

页面结构：

1. 基础信息：名称、slug、简介、分类、标签、可见性、版本。
2. 内容编辑：Tiptap Markdown editor。
3. 引用检查：列出解析出的 Prompt refs、可见性风险、循环风险。
4. 提交预览：原始 Markdown / 展开 Markdown 双 tab。

### 11.4 审核详情

`team/admin/Reviews` 保持一个入口，增加类型筛选：

- 全部
- Skill
- Prompt

Prompt 审核详情展示：

- 基础信息。
- Markdown 原文。
- 展开预览。
- 引用图和引用校验结果。
- 标签、分类、版本、可见性。
- 审核评论和决策按钮。

## 12. CLI 设计

### 12.1 新命令

```text
smskill prompt search <query> [--team <teamId>] [--limit 20] [--json]
smskill prompt info <ref>
smskill prompt get <ref>
  [--out <file>]
  [--prompts-dir <dir>]
  [--raw]
  [--force]
```

`ref` 支持：

```text
<teamSlug>/<promptSlug>
<teamId>/<promptSlug>
<promptSlug>   # 需要 config.defaultTeamId
```

### 12.2 导出路径

默认：

```text
~/.smskill/prompts/<teamSlug>/<slug>.md
```

指定 `--out` 时写入具体文件。

指定 `--prompts-dir` 时写入：

```text
<prompts-dir>/<teamSlug>/<slug>.md
```

### 12.3 导出 Markdown frontmatter

展开导出示例：

```markdown
---
type: prompt
team: ludou-fe
slug: login-context
version: 1.2.0
exportedAt: 2026-05-25T12:00:00Z
resolvedRefs:
  - ludou-fe/base-role@0.4.0
  - ludou-fe/error-format@1.0.1
---

...
```

`version` 是主 Prompt 的当前版本；`resolvedRefs` 记录本次展开时实际读取到的最新审核版本，用于本地回溯。

### 12.4 `suite install` 调整

`smskill suite install <ref>`：

1. 拉取 suite detail。
2. 对 `SKILL` item 走现有安装逻辑。
3. 对 `PROMPT` item 调用 Prompt download。
4. 默认导出展开 Markdown。
5. 任一项失败时沿用现有 `continue-on-error` 策略。
6. lockfile 记录 Prompt 导出记录，`source='skillstack-prompt'`，`via.suite` 写入 suite 信息。

### 12.5 PAT 白名单

`JwtAuthFilter.isPatAllowedPath` 需要增加：

- Prompt 详情。
- Prompt 版本列表。
- Prompt download。
- Prompt install/export counter。
- 混合 suite detail。

PAT 仍只作为消费凭据，不允许创建、编辑、审核。

## 13. 权限与安全

### 13.1 可见性

读取规则：

- `PUBLIC + APPROVED`：匿名可读，前提是团队 public home 允许展示。
- `TEAM_PRIVATE`：仅团队成员可读。
- `UNLISTED`：仅有详情链接且有权限的人可读，不进入公开列表。
- `DRAFT / PENDING_REVIEW / REJECTED / CHANGES_REQUESTED / WITHDRAWN`：只在 review / MySubmissions 中可见。

### 13.2 引用权限

保存或审核 Prompt 时：

- 当前提交者必须能读取被引用 Prompt。
- `PUBLIC` Prompt 不允许引用 `TEAM_PRIVATE` Prompt。
- `TEAM_PRIVATE` Prompt 可以引用同团队私有或公开 Prompt。
- 跨团队引用第一期不开放，避免权限和导出边界复杂化。

### 13.3 循环引用

在以下时机校验循环：

1. 编辑器引用检查。
2. 提交审核。
3. 审核通过。
4. CLI / Web 展开导出。

approve 是最终强校验；其它阶段可以给用户即时提示。

## 14. 通知、活动流与统计

新增 activity kind：

- `PROMPT_SUBMITTED`
- `PROMPT_APPROVED`
- `PROMPT_REJECTED`
- `PROMPT_VERSION_PUBLISHED`
- `PROMPT_EXPORTED`
- `PROMPT_ADDED_TO_SUITE`

通知：

- 提交 Prompt 审核通知团队 OWNER / ADMIN。
- 审核结果通知提交者。
- 审核评论沿用 review comment 通知。
- 套件更新包含 Prompt 时沿用 suite 更新通知，但文案显示混合资产数量。

统计：

- 团队增加 `public_prompts`、`private_prompts` 或通过查询聚合生成。
- 成员贡献保留 `skills_count`，新增 `prompts_count`，不混用。
- 首页 tab 分别展示 Skill 数和 Prompt 数。

## 15. 结构健康度

这次会触及的现有文件偏胖风险较高：

- `ReviewService` 已承担 Skill 审核物化逻辑，新增 Prompt 前应先抽出 materializer 接口，避免继续膨胀。
- `SuiteService` 当前 SQL 和 DTO 都围绕 Skill，混合资产应先拆出 item loader。
- `SkillReviewService` 是 Skill 专用，评价抽象时应新增 `AssetReviewService`，再让 Skill endpoint 复用。
- `frontend/src/api/endpoints.ts` 已集中承载大量 API 类型，新增 Prompt API 时应按领域拆分或至少分区清晰。

允许的前置微重构：

- 只搬移共享结构，不改变行为。
- 不在本需求里重写 Skill 创建和下载主链路。
- 不调整根配置、依赖大版本或路由总入口之外的无关结构。

## 16. 实施分期

### Phase 1：Prompt 主链路闭环

- 新增 Prompt 数据模型与 migration。
- 新增 Tiptap Markdown Prompt 编辑器。
- 支持 Prompt 创建、草稿、审核、approve 物化、版本历史。
- 支持 `@prompt` 引用解析和循环/权限校验。
- 新增团队 Prompt 库和 Prompt 详情页。
- 新增 CLI `prompt get` 单 Prompt 导出。

验收：

- 用户能创建含引用的 Prompt，提交审核，通过后进入团队 Prompt 库。
- CLI 能下载展开后的单个 `.md`。
- 历史版本可查看，但引用仍按最新审核版本展开。

### Phase 2：横向能力接入

- Review 队列增加 `target_type` 筛选和 Prompt 详情渲染。
- Suite 支持混合 `SKILL / PROMPT` item。
- `suite install` 默认安装 Skill 并导出 Prompt。
- 评价/回复/收藏抽象到 `AssetReviewService` / `asset_stars`。
- 首页/广场增加 Prompt tab。

验收：

- 同一个审核队列可处理 Skill 和 Prompt。
- 套件中可以维护 Prompt，CLI 安装套件不会漏掉 Prompt。
- Prompt 详情可评价，评分不会污染 Skill 评分。

### Phase 3：体验和运营补齐

- 引用图谱 UI。
- Prompt 版本 diff。
- Prompt 影响面提示：某 Prompt 更新会影响哪些上层 Prompt。
- 批量导出 Prompt。
- 后台统计和活动流完善。

验收：

- 维护者能追踪 Prompt 依赖影响。
- 用户能理解导出的 Markdown 来自哪些 Prompt 版本。

## 17. 验证计划

后端：

- Prompt 创建、草稿、提交审核、approve、reject、request changes、resubmit。
- Prompt version bump 不影响已上线版本直到 approve。
- 引用解析读取最新 `APPROVED` 版本。
- 循环引用拦截。
- Public Prompt 引用 Private Prompt 被拦截。
- 非成员不能读取私有 Prompt。
- Suite mixed items 权限过滤正确。
- Asset reviews 对 Skill / Prompt 分别聚合。

前端：

- Tiptap 编辑器 Markdown round-trip。
- `@prompt` 搜索、插入、删除、保存、重新打开。
- Prompt 审核详情原文/展开预览一致。
- 首页 tab 和团队 Prompt 库 responsive 检查。
- 套件编辑器混合 item 排序和删除不丢数据。

CLI：

- `smskill prompt get team/slug` 默认导出展开 md。
- `--raw` 保留引用标记。
- `--out`、`--prompts-dir`、`--force` 行为正确。
- `suite install` 混合资产部分失败时 obey `continue-on-error`。
- PAT 仅允许消费路径，不允许写入路径。

回归：

- 现有 Skill 搜索、详情、下载、审核、套件安装、评价不回归。
- 公共广场仍只展示公开且审核通过内容。
- Flyway 只追加 migration，不修改已应用 migration。

## 18. 风险与对策

| 风险 | 对策 |
|---|---|
| 审核抽象影响现有 Skill 审核 | 保留旧字段，新增通用字段双写，先让 Skill 行为保持原样 |
| Suite 混合资产破坏旧 CLI | `SuiteDetail.skills` 短期保留为 Skill 投影，新 CLI 使用 `items` |
| 动态引用导致上层 Prompt 内容隐式变化 | 详情和 CLI frontmatter 明确列出实际解析版本；缓存随引用更新失效 |
| Public Prompt 泄露私有引用内容 | approve 和 resolve 双重校验，Public 禁止引用 Private |
| Tiptap 与 Markdown 不可逆 | 使用自定义 `PromptMention` 节点保存标准 link 标记，并以 `promptMarkdown.test.ts` 覆盖 Markdown / Tiptap JSON round-trip |
| 评价迁移影响 Skill 评分 | 先迁移数据，再让 Skill endpoint 读通用服务；保留回滚脚本或兼容读 |

## 19. 最小成功标准

第一版完成后，必须满足：

1. 团队成员可以创建、编辑、提交审核 Prompt。
2. Prompt 内容以 Markdown 保存，并可通过 Tiptap Prompt 编辑器往返打开；Prompt mention 以标准 Markdown link 形态落库。
3. Prompt 可以 `@` 引用多个 Prompt，引用解析永远使用最新审核版本。
4. Prompt 可以进入审核队列，管理员可按类型查看详情并审批。
5. 审核通过的 Prompt 进入团队 Prompt 库。
6. Prompt 可以加入套件。
7. CLI 可以下载单个 Prompt 为 `.md` 文件。
8. 首页有 Prompt tab，公共展示只出现公开且审核通过的 Prompt。
9. Prompt 可以被评价，且评价数据与 Skill 隔离。
