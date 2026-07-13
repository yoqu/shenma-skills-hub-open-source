# ROADMAP

依据 `docs/superpowers/specs/2026-05-27-skill-client-sync-publish-design.md`。
分工以"可并行模块"为单位，每个 Owner 一个负责人。

## 需求背景

### 痛点

- **使用者**：装了不更新、多端工具箱不一致、批量同步缺失。
- **作者**：迭代发布摩擦大、看不到使用情况、反馈闭环缺失。
- **团队管理者**：看不见 skill 资产健康度，新人入职无默认配置。

### 4 条核心用户旅程（v1 必须打通）

| 旅程 | 目标 |
|---|---|
| J1 同步与升级 | 跨团队 / 跨广场订阅、多端一致、批量升级、跳过版本 |
| J2 作者持续发布 | 本地副本 → 一键打包 → 按团队策略审核 → 通知订阅者 |
| J3 作者反馈 | 聚合统计：订阅 / 安装 / 活跃 / 版本分布 / 趋势 |
| J4 团队资产看板 | 团队 skill 总数、活跃 vs 沉睡、Top 榜、覆盖率、版本一致性 |

### 核心产品规则（约束开发）

- 订阅 ⊥ 安装；订阅跟人云端唯一，安装跟设备。
- 用户全局订阅范围：跨团队 + 公共广场。
- 多端 M3：新设备一键同步；卸载只本机，退订全局。
- 审核策略下放团队：`always` / `first_only` / `none`。
- 已发布版本不可撤回；skill 可下架（软状态，可恢复）。
- 隐私 P3：聚合默认，用户 opt-in 让作者可见名单，管理者不窥个人 skill 清单。
- 通知集 v1：N1 / N2 / N4 / N5 / N8。
- skill 依赖联动，循环依赖必拦；退订不连带依赖。
- 推荐包以团队级公开 suite 承载（不支持订阅 suite）。

## Phase 0 · 形态决策（串行）

| 项 | 内容 | Owner |
|---|---|---|
| F1 | 客户端形态选型（Electron / Tauri / VSCode 扩展 / Web+daemon） | 架构 |
| F2 | 同步引擎抽象（CLI 与 GUI 是否共享内核） | 架构 |

## Phase 1 · 后端能力补齐（5 并行）

| 模块 | 内容 |
|---|---|
| BE-Sub | 用户级订阅表 + 跨团队/广场订阅 API |
| BE-Device | 设备注册 + per-device 安装状态 + 安装事件流水 |
| BE-Stat | 统计聚合（订阅/安装/活跃/版本分布/趋势）+ opt-in 名单 |
| BE-Suite | 团队推荐包标记（公开 suite + `is_recommended`） |
| BE-Policy | 团队 `review_policy` 字段 + 发布流读取 |
| BE-Lifecycle | skill 下架状态机 + 已发布版本不可撤回 |
| BE-Dep | skill 依赖表 + 循环依赖检测 + 订阅/安装联动 |
| BE-Notify | 接入 N1/N2/N4/N5/N8 到 unified notification center |

## Phase 2 · 前端 Web 补齐（4 并行，依赖 Phase 1）

| 页面 | 内容 |
|---|---|
| FE-MySub | "我的订阅"列表（跨团队/广场，状态：订阅/安装/版本/可升级/已下架） |
| FE-AuthorDash | "我的发布"作者统计看板（J3） |
| FE-AdminDash | 团队资产健康度看板（J4） |
| FE-AdminCfg | 团队推荐包维护 + `review_policy` 配置入口 |
| FE-Submit | "我的提交"拒绝原因展示 + 重提 |
| FE-Skill | skill 下架按钮 + 依赖声明 UI |

## Phase 3 · 桌面客户端（依赖 Phase 0/1）

| 模块 | 内容 |
|---|---|
| GUI-Shell | 客户端骨架 + 登录 + 设备注册 |
| GUI-Sync | 同步引擎（本地 manifest、增量检测、跳过版本、批量升级） |
| GUI-Install | 新设备一键同步 + 卸载/退订语义（本机 vs 全局） |
| GUI-Author | 本地副本绑定 + 一键发布（J2） |
| GUI-Notify | 客户端内通知展示 + 桌面推送 |
| GUI-Offline | 离线降级与同步重放 |

## Phase 4 · CLI 对齐

| 项 | 内容 |
|---|---|
| CLI-Sync | CLI 接入同步内核：订阅 / 安装 / 升级 / 跳过版本与 GUI 语义一致 |

## Phase 5 · 联调与压测

| 项 | 内容 |
|---|---|
| QA-E2E | J1–J4 端到端跑通 |
| QA-Multi | 多端一致性（M3）验证 |
| QA-Dep | 依赖联动 + 循环依赖 + 下架链路验证 |

## 非目标（v1 不做）

角色 4 本地反哺、手动回滚、配置导入导出、试用模式、skill 类型分化、多作者协同、订阅作者、订阅 suite、按 diff 自动审核分流。

## 依赖图

```
Phase 0 → Phase 1 → Phase 2 (Web)
                 ↘
                   Phase 3 (Desktop) → Phase 4 (CLI) → Phase 5 (QA)
```
