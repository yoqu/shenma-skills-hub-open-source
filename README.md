# SkillStack

团队内的 Skill 分享与管理平台：沉淀、审核、检索、复用团队 skill 与套件。

## 当前能力

- 公共广场：展示 PUBLIC + APPROVED skill。
- 团队工作区：team skill 库、审核队列、成员与邀请、suite、活动流。
- 提交流程：skill 创建、版本管理、审核发布。
- CLI `smskill`：已发布到 npm，支持 search / info / install / list / remove / suite / prompt / upload。
- Web 前端 + Spring Boot 后端 + MySQL 8 + Flyway。

入口：`./scripts/services.sh start`（前端 5173 / 后端 8080 / MySQL 3307）。

## 技术栈

- 前端：Vite + React 18 + TS + Tailwind + shadcn/ui + TanStack Query。
- 后端：Spring Boot 3 + MyBatis Plus + JWT + Flyway。
- CLI：Node 20 + commander + axios + zod；用户安装入口是 `npm install -g smskill`。

详细约定见 `AGENT.md`。

## 规划

v1 下一阶段聚焦"客户端 + 同步 + 持续发布 + 统计"四块能力，服务**使用者 / 作者 / 团队管理者**三类角色，打通四条核心旅程：

| 旅程 | 解决的痛点 |
|---|---|
| J1 同步与升级 | 装了不更新、多端不一致、批量升级 |
| J2 作者持续发布 | 迭代摩擦大，发布门槛高 |
| J3 作者反馈 | 看不到使用情况 |
| J4 团队资产看板 | 看不见 skill 健康度与渗透率 |

关键产品规则：

- **订阅 ⊥ 安装**：两个独立状态。
- **用户全局订阅**：跨团队 / 跨广场。
- **多端 M3**：订阅跟人、安装跟设备，新设备一键同步。
- **审核策略下放团队**（`always` / `first_only` / `none`）。
- **版本不可撤回，skill 可下架**。
- **隐私 P3**：聚合默认，opt-in 名单。
- **skill 依赖联动**，禁止循环依赖。
- **推荐包**以团队级公开 suite 承载。

详细需求 spec：`docs/superpowers/specs/2026-05-27-skill-client-sync-publish-design.md`
开发分工与阶段：`ROADMAP.md`
