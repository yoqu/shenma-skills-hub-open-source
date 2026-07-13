# Skill 桌面客户端 v1 设计

- 状态：设计待评审
- 日期：2026-05-29
- 范围：桌面端 Skill 管理工具、浏览器登录、`user_skills` 云端清单、客户端本地安装状态、我的 Skill / Skills 广场 / 团队推荐 / 设置页面
- 相关背景：`2026-05-27-skill-client-sync-publish-design.md` 是更大范围的产品层设想；本文档按本轮讨论收敛 v1，不包含 Prompt、作者统计、设备云端表、安装事件上报、复杂订阅通知。

## 1. 目标

为普通用户提供一个桌面端 Skill 管理工具，让用户可以：

- 查看自己的 Skill 清单，区分个人导入和广场/团队推荐添加的 Skill。
- 从 Skills 广场添加公开 Skill，到本地安装或后续再安装。
- 查看团队推荐清单，一键添加或安装团队推荐 Skill。
- 管理本地安装目标，包括当前设备、默认 Agent 和 Claude / Codex / OpenClaw 安装路径。
- 在多台电脑之间通过云端清单同步“有哪些 Skill”，但每台电脑是否安装、安装在哪个路径由本地决定。
- 打开客户端时完成登录，登录态安全保存在本地，后续启动自动进入主界面。

## 2. 非目标

本期不做：

- Prompt 管理。表名和 API 均聚焦 Skill。
- 云端设备表、云端安装表、设备安装明细统计。
- 个人导入 Skill 的云端版本历史。v1 只保存当前版本。
- 取消订阅后保留本地副本的单独状态。删除动作会同时触发本地卸载。
- 作者统计、团队资产看板、安装/活跃聚合指标。
- 复杂通知策略。通知可后续接入，但不作为本设计实现前置。
- 本地修改 Skill 后回推给原作者。

## 3. 信息架构

未登录时先进入登录页，不展示业务导航。登录完成后进入主界面。

桌面端主导航：

| 菜单 | 用途 |
|---|---|
| 我的 Skill | 当前用户云端清单 + 本地安装状态合成后的主工作台 |
| Skills 广场 | 浏览公开 Skill，添加到我的 Skill，或添加后立即安装 |
| 团队推荐 | 当前团队维护的推荐 Skill 清单，支持批量添加/安装 |
| 设置 | 当前设备、默认安装目标、Agent 安装路径、通知、账号团队 |

通知入口放右上角。左下角展示当前登录用户头像和用户名；点击用户区域打开账号菜单，菜单内只包含设置、关于、退出登录。设置入口从左下角账号菜单进入。

## 4. 核心概念

### 4.1 云端清单

云端清单表示“这个用户有哪些 Skill”。本期统一使用 `user_skills` 表承载：

- 个人导入 Skill。
- 从 Skills 广场或团队推荐添加的 Skill。

### 4.2 本地安装

本地安装表示“当前电脑是否已经安装某个 Skill，以及安装到了哪里”。本地安装状态不进云端数据库，由客户端本地 JSON 或 SQLite 维护。

建议 v1 使用 SQLite。理由：

- 后续状态查询、筛选、迁移比 JSON 更稳定。
- 客户端工具会持续增长，本地记录不只是一个 lockfile。
- 仍然可以保持实现简单，只建 2-3 张本地表。

如实现成本优先，也可以先用 JSON，但设计语义不依赖具体落盘格式。

### 4.3 登录态

客户端登录态本地保存，至少包含：

| 字段 | 含义 |
|---|---|
| `token` | 后端签发的 JWT，用于访问 `/api/me`、`/api/user-skills` 等接口 |
| `user` | 当前用户快照，用于左下角展示头像、名称、handle |
| `login_at` | 登录完成时间 |
| `expires_at` | token 过期时间；如后端未返回精确时间，客户端按签发策略估算 |

token 应放在桌面系统安全存储中，例如 macOS Keychain；本地 SQLite/JSON 只保存用户展示快照和非敏感配置。

### 4.4 类型

`user_skills.type`：

| type | 含义 |
|---|---|
| PERSONAL | 用户本地导入并上传到云端的个人 Skill |
| SUBSCRIBED | 用户从广场或团队推荐添加的 Skill |

个人 Skill 发布到广场后，不新增 `published_skill_id` 字段，直接回填 `skill_id`。

## 5. 云端表设计

### 5.1 字段规则

本项目数据库字段规则：

- 除 `DATETIME` / `TEXT` 类型字段外，字段尽量 `NOT NULL`，并提供默认值。
- 不创建外键。
- 索引保持精简，只覆盖核心查询路径。
- 字段命名、类型与现有 `skills`、`skill_versions`、`reviews` 对齐。
- 包存储字段沿用现有命名 `zip_url`，它在当前项目里表示 storage key。

### 5.2 `user_skills` DDL

```sql
CREATE TABLE user_skills (
    id             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
    user_id        BIGINT       NOT NULL DEFAULT 0 COMMENT '用户 ID',
    type           ENUM('PERSONAL','SUBSCRIBED') NOT NULL DEFAULT 'PERSONAL' COMMENT '类型：PERSONAL=个人导入，SUBSCRIBED=广场添加',

    skill_id       BIGINT       NOT NULL DEFAULT 0 COMMENT '关联 skills.id；SUBSCRIBED 必填；PERSONAL 发布到广场后回填；0 表示未关联公开 Skill',
    review_id      BIGINT       NOT NULL DEFAULT 0 COMMENT '关联发布审核 reviews.id；个人 Skill 提交发布审核后记录；0 表示无审核单',

    slug           VARCHAR(96)  NOT NULL DEFAULT '' COMMENT 'Skill slug，沿用 skills.slug',
    name           VARCHAR(128) NOT NULL DEFAULT '' COMMENT 'Skill 名称，沿用 skills.name',
    short_desc     VARCHAR(512) NOT NULL DEFAULT '' COMMENT '一句话描述，沿用 skills.short_desc',
    cat_code       VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '分类编码，沿用 skills.cat_code',
    icon           VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '图标，沿用 reviews.icon，预留图标 key/URL',
    version        VARCHAR(32)  NOT NULL DEFAULT '0.1.0' COMMENT '当前云端版本，沿用 skills.version / skill_versions.version',

    zip_url        VARCHAR(512) NOT NULL DEFAULT '' COMMENT '个人导入 Skill 的 zip storage key，沿用 reviews.zip_url / skill_versions.zip_url',
    files_count    INT          NOT NULL DEFAULT 0 COMMENT 'zip 内文件数量，沿用 reviews.files_count / skill_versions.files_count',
    safety         ENUM('pass','warn','fail') NOT NULL DEFAULT 'pass' COMMENT '安全检查结果，沿用 skills.safety',
    eval_score     INT          NOT NULL DEFAULT 0 COMMENT '评测分数，沿用 skills.eval_score',
    langs          JSON         NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '语言数组 JSON，沿用 skills.langs',

    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除标记：0=未删除，1=已删除',

    PRIMARY KEY (id),
    UNIQUE KEY uk_user_skills_user_type_slug (user_id, type, slug),
    KEY idx_user_skills_user_type_skill (user_id, type, skill_id),
    KEY idx_user_skills_user_type (user_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户 Skill 清单：个人导入与广场添加';
```

### 5.3 索引说明

| 索引 | 用途 |
|---|---|
| `uk_user_skills_user_type_slug` | 防止同一用户同一类型重复导入/添加同 slug Skill |
| `idx_user_skills_user_type_skill` | 查询用户与公开 Skill 的关系；服务层对 `SUBSCRIBED + skill_id` 做幂等 |
| `idx_user_skills_user_type` | 我的 Skill 按用户和类型分组查询 |

`skill_id = 0` 时会参与索引。由于同一用户可能有多个 `PERSONAL` 未发布 Skill，但它们都 `skill_id = 0`，不能对 `(user_id, type, skill_id)` 建唯一索引。重复订阅校验放在服务层：当 `type = SUBSCRIBED AND skill_id > 0` 时幂等返回已有记录。

## 6. 与现有表的关系

| 场景 | `user_skills` | 现有表 |
|---|---|---|
| 个人导入，未发布 | `type=PERSONAL`，`skill_id=0`，保存 `zip_url/version` | 不写 `skills` |
| 个人提交发布审核 | 回填 `review_id` | 写 `reviews`，走 review-first |
| 发布审核通过 | 回填 `skill_id` | 物化 `skills`、`skill_versions` |
| 广场添加 | `type=SUBSCRIBED`，`skill_id=skills.id` | 读 `skills`、`skill_versions` |
| 团队推荐添加 | 同广场添加 | 推荐来源由团队推荐接口提供，不进入 `user_skills` |

发布仍沿用现有 `reviews -> skills -> skill_versions` 流程，不另建公开发布资产表。

## 7. 本地存储设计

本地至少需要记录：

| 字段 | 含义 |
|---|---|
| `user_skill_id` | 云端 `user_skills.id`；云端删除后仍用于识别本地残留 |
| `type` | `PERSONAL` / `SUBSCRIBED` 的本地快照 |
| `skill_id` | 公开 Skill id，本地快照；无则为 0 |
| `slug` | 安装目录和展示使用 |
| `name` | 本地详情兜底展示 |
| `version` | 当前本地安装版本 |
| `agent` | `CLAUDE` / `CODEX` / `OPENCLAW` |
| `install_path` | 实际安装路径 |
| `installed_at` | 安装时间 |
| `updated_at` | 最近一次本地记录更新时间 |

设置类本地信息：

| 字段 | 含义 |
|---|---|
| `device_name` | 当前设备显示名 |
| `default_agent` | 默认安装目标 |
| `agent_paths` | 各 Agent 的安装路径 |

## 8. 我的 Skill 状态

### 8.1 个人部分

| 状态 | 条件 | 操作 |
|---|---|---|
| 未安装 / 可安装到本地 | 云端有 `PERSONAL` 记录，本地无安装记录 | 查看、安装、删除 |
| 已安装 / 最新 | 云端有记录，本地版本等于云端 `user_skills.version` | 查看、删除 |
| 已安装 / 云端有更新 | 云端有记录，本地版本不等于云端 `user_skills.version` | 查看、更新、删除 |
| 已安装 / 云端已删除 / 本地保留，仍可用 | 本地有记录，但云端 `user_skills` 已删除或查不到 | 查看、卸载 |

### 8.2 订阅部分

| 状态 | 条件 | 操作 |
|---|---|---|
| 已安装 / 最新 | 云端有 `SUBSCRIBED` 记录，本地版本等于 `skills.version`，且 Skill 未下架 | 查看、删除 |
| 未安装 / 可安装到本地 | 云端有 `SUBSCRIBED` 记录，本地无安装记录，且 Skill 未下架 | 查看、安装、删除 |
| 已安装 / 可更新 / 本地 vX，云端 vY | 云端有记录，本地版本不等于 `skills.version`，且 Skill 未下架 | 查看、更新、删除 |
| 已下架 / 本地保留，仍可用 | 本地有记录，但公开 Skill 已下架或不可见 | 查看、卸载 |

下架判断：

- `skills.status = UNLISTED` 或 `ARCHIVED`，客户端展示为已下架。
- 如果服务端详情不可读，但本地仍有安装记录，也按“已下架 / 本地保留”兜底展示。

## 9. 操作语义

| 操作 | 语义 |
|---|---|
| 查看 | 云端存在时看云端详情；云端删除/下架但本地保留时看本地元数据快照 |
| 安装 | 下载云端 zip，安装到默认 Agent 路径，写本地安装记录 |
| 更新 | 下载云端新版本，覆盖本地安装，更新本地安装记录 |
| 卸载 | 卸载本地技能，不影响云端数据 |
| 删除 | 删除云端数据，并卸载本地技能 |

删除和卸载 tips：

- 删除：`删除云端数据，并卸载本地技能`
- 卸载：`卸载本地技能，不影响云端数据`

删除是客户端编排动作：

1. 调服务端删除 `user_skills` 记录。
2. 如果本地已安装，执行本地卸载。
3. 如果服务端删除成功但本地卸载失败，客户端提示“云端数据已删除，本地卸载失败”，并保留本地残留状态供用户重试卸载。

## 10. 页面设计

画板文件：

`/.superpowers/brainstorm/95493-1779964675/content/desktop-pages-overview-v4.html`

当前包含：

- 页面 0：登录
- 页面 1：我的 Skill
- 页面 2：设置 / 安装目标
- 页面 3：Skills 广场
- 页面 4：团队推荐

### 10.1 登录页

未登录启动时展示独立登录页：

- 居中展示产品标识、产品名和“登录以开始使用”文案。
- 主操作按钮：`通过浏览器登录`。
- 点击后客户端调用现有设备授权接口发起登录，并打开系统浏览器。
- 登录页右下角展示客户端版本号。
- 登录期间展示等待状态，例如“已打开浏览器，等待登录完成”。
- 如果用户取消或授权过期，回到初始登录页，允许重新发起。

### 10.2 登录用户菜单

登录后，左下角展示：

- 用户头像。
- 用户名。
- 下拉箭头。

点击后展示账号菜单：

| 菜单项 | 行为 |
|---|---|
| 设置 | 进入设置页 |
| 关于 | 展示客户端版本和平台信息 |
| 退出登录 | 清除本地 token，回到登录页 |

退出登录只清除登录态，不删除本地已安装 Skill。

### 10.3 我的 Skill

页面元素：

- 顶部操作：`本地导入`、`一键更新/安装`。
- 筛选标签：`全部`、`可更新`、`未安装`。
- 搜索框。
- 分组：`个人`、`订阅`。
- 每行操作使用图标，不使用文字按钮。
- 状态标签放在 Skill 名称右侧。

### 10.4 Skills 广场

页面能力：

- 搜索公开 Skill。
- 分类、排序、安全等级筛选。
- 卡片展示 Skill 名称、版本、安装数、添加状态。
- 未添加 Skill 支持：
  - `添加`：只写 `user_skills(type=SUBSCRIBED)`，不安装。
  - `安装`：先确保云端清单存在，再安装到本地。
- 已添加 Skill 展示“已在我的 Skill”。
- 可更新 Skill 展示更新入口。

### 10.5 团队推荐

页面能力：

- 展示当前团队推荐 Skill 清单。
- 顶部展示推荐总数、未安装数、可更新数。
- 支持一键添加/安装。
- 单项支持查看、添加、安装、更新、删除、卸载等操作，具体取决于用户清单和本地状态。

团队推荐本身不新增 `user_skills.type`。用户对推荐项执行添加或安装后，仍写入 `type=SUBSCRIBED`。

### 10.6 设置 / 安装目标

页面能力：

- 当前设备名称。
- 默认安装目标：Claude / Codex / OpenClaw。
- 各 Agent 安装路径配置。
- 后续可扩展通知、账号与团队。

## 11. 后端 API 草案

### 11.1 登录

桌面端优先复用现有 CLI device authorization 流程。

现有接口：

```text
POST /api/auth/cli/device-init
```

客户端发起登录会话。返回 `deviceCode`、`userCode`、`verificationUri`、`expiresIn`、`interval`。

客户端打开系统浏览器访问 `verificationUri`。如果用户未登录 Web，则 Web 端先跳转登录；登录后在授权页确认。

```text
POST /api/auth/cli/device-poll
```

客户端用 `deviceCode` 轮询。审批通过后返回 JWT 和用户信息。

```text
GET /api/me
```

客户端启动时校验本地 token 是否有效，并刷新当前用户信息。

桌面端不需要新增独立登录协议。后续若要区分 CLI 和桌面端审计，可在 `device-init` 的 `User-Agent` 中传入桌面客户端标识，例如 `SkillStack-Desktop/0.1.0`。

### 11.2 我的 Skill

```text
GET /api/user-skills
```

返回当前用户的云端清单。服务端可联查 `skills` 补齐订阅 Skill 的公开版本、状态、可见性。

```text
POST /api/user-skills/import
```

个人导入。请求包含 `slug/name/version/zip_url/files_count/cat_code/icon/short_desc/langs`，创建或覆盖 `type=PERSONAL` 的同 slug 记录。

```text
POST /api/user-skills/subscribe
```

广场/团队推荐添加。请求包含 `skill_id`。服务端校验当前用户可见该 Skill，然后幂等创建 `type=SUBSCRIBED` 记录。

```text
DELETE /api/user-skills/{id}
```

删除云端清单记录。客户端负责后续本地卸载。

### 11.3 发布

```text
POST /api/user-skills/{id}/publish
```

个人 Skill 发起发布审核。服务端读取 `user_skills` 中的个人导入数据，复用现有 review-first 提交流程创建 `reviews`，并回填 `review_id`。

审核通过后：

- 现有 `ReviewService.approve` 物化 `skills`、`skill_versions`。
- 新增回填逻辑：根据 `review_id` 找到 `user_skills`，回填 `skill_id`。

### 11.4 广场和团队推荐

广场可复用现有公开 Skill API，再增加“当前用户是否已添加”的轻量字段。也可由客户端拿广场列表后和 `/api/user-skills` 合并。

团队推荐 v1 可以基于现有 suite 能力表达推荐清单：

- 团队维护一个推荐 suite。
- 客户端读取推荐 suite 内 Skill。
- 用户添加/安装推荐项时写入 `user_skills(type=SUBSCRIBED)`。

## 12. 状态计算

状态由客户端合成：

```text
云端 user_skills
  + 公开 Skill 当前状态和版本
  + 本地安装记录
  = 我的 Skill 展示状态
```

服务端不判断“本地是否安装”，因为安装状态只存在客户端。

推荐计算流程：

1. 启动或刷新时拉取 `/api/user-skills`。
2. 读取本地安装记录。
3. 用 `user_skill_id`、`skill_id`、`slug` 合并。
4. 标记云端缺失但本地存在的条目为“云端已删除”或“已下架 / 本地保留”。
5. 根据版本差异标记可更新。

## 13. 边界和失败处理

| 场景 | 处理 |
|---|---|
| 云端删除成功，本地卸载失败 | 展示“云端数据已删除，本地卸载失败”，保留本地残留，可重试卸载 |
| 本地安装失败 | 不写本地安装记录；云端清单如果已添加则保留 |
| 更新失败 | 保留旧版本本地安装记录 |
| 用户在另一台设备删除云端记录 | 当前设备刷新后，若本地仍安装，展示“云端已删除 / 本地保留” |
| 订阅 Skill 下架 | 如果本地已安装，展示“已下架 / 本地保留”；如果未安装，可从我的 Skill 隐藏或展示不可安装，v1 推荐隐藏不可安装项 |
| `skills.version` 与 `user_skills.version` 不一致 | 对 `SUBSCRIBED` 以 `skills.version` 为准；对 `PERSONAL` 以 `user_skills.version` 为准 |

## 14. 实施顺序建议

1. 客户端实现浏览器登录：复用 `device-init` / `device-poll`，保存 token，启动时 `/api/me` 校验。
2. 后端新增 `user_skills` 表、实体、Mapper、Service。
3. 后端新增我的 Skill API：列表、个人导入、订阅添加、删除。
4. 后端接入个人 Skill 发布审核，并在审核通过后回填 `skill_id`。
5. 客户端实现本地存储和安装目标设置。
6. 客户端实现我的 Skill 状态合成和操作。
7. 客户端实现 Skills 广场添加/安装状态。
8. 客户端实现团队推荐添加/安装状态。

## 15. 待确认风险

- 现有 `SkillDownloadService` 当前仍有动态生成 zip 的路径，实际安装时应优先使用 `skill_versions.zip_url` 对应真实上传包；若没有真实包，再决定是否允许动态包兜底。该行为涉及历史实现语义，标记为待确认风险。
- 团队推荐是否完全复用 suite，还是新增团队推荐配置表。当前建议复用 suite，但若产品希望推荐有独立排序、说明和强制标记，后续可能需要单独表。标记为待确认风险。
- `JSON NOT NULL DEFAULT (JSON_ARRAY())` 依赖 MySQL 8 表达式默认值。当前 dev 数据库是 MySQL 8.4，支持该写法；若其他环境版本低于 8.0.13，需要降级为 `JSON DEFAULT NULL` 或应用层填默认值。标记为部署环境待确认风险。
- 桌面端复用 CLI device authorization 时，现有表名仍是 `cli_device_auth`。语义上可以复用，但命名偏 CLI；若后续审计要严格区分客户端类型，可新增 `client_type` 字段或重命名为通用设备授权表。当前不为 v1 阻塞，标记为待确认风险。
