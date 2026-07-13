# 桌面客户端未实现事项 TODO

> 更新时间：2026-05-29
>
> 范围：记录当前桌面客户端已讨论但尚未真正实现的能力，并补充可交接给其他 Agent 的任务边界、依赖关系和验收标准。
>
> 当前已实现内容主要是后端用户 Skill 清单、桌面端页面骨架、登录流程、状态计算和基于 localStorage 的临时安装状态。

## 交接上下文

### 当前项目边界

- 本次只做 Skill 桌面客户端，不扩展 Prompt 等其他资产类型。
- 桌面端是独立项目，目录为 `desktop/`，不要把桌面客户端继续写到 `frontend/`。
- `scripts/services.sh` 只管理后端和 Web 前端，不管理桌面客户端。
- 桌面端开发脚本保持简单双终端模式：
  - `npm run dev`：启动 Vite，端口 `5174`。
  - `npm run dev:electron`：使用 `VITE_DEV_SERVER_URL=http://127.0.0.1:5174 electron .` 启动 Electron。
- 当前“安装/更新/卸载”只是基于 localStorage 的临时状态，不会真实下载、解压、写入本地 Skill 目录。
- 当前设置页保存的安装目标路径也只是页面状态，尚未被真实安装链路使用。

### 关键代码入口

- 桌面端入口：`desktop/src/App.tsx`、`desktop/src/main.tsx`。
- 桌面端页面：`desktop/src/pages/MySkillsPage.tsx`、`desktop/src/pages/PlazaPage.tsx`、`desktop/src/pages/RecommendationsPage.tsx`、`desktop/src/pages/DesktopSettingsPage.tsx`、`desktop/src/pages/DesktopLogin.tsx`。
- 桌面端状态计算：`desktop/src/pages/status.ts`，测试为 `desktop/src/pages/status.test.ts`。
- 当前临时本地安装状态：`desktop/src/pages/localInstallStore.ts`。
- 桌面端 API 定义：`desktop/src/api/client.ts`、`desktop/src/api/endpoints.ts`。
- Electron 主进程与 preload：`desktop/electron/main.cts`、`desktop/electron/preload.cts`。
- 后端用户 Skill：`backend/src/main/java/com/skillstack/userskill/`。
- 后端迁移表：`backend/src/main/resources/db/migration/V29__user_skills.sql`。

### 已确认业务语义

- “我的 Skill”分为个人和订阅两类，由 `user_skills.type` 区分：
  - `PERSONAL`：用户自己导入并保存到云端的 Skill。
  - `SUBSCRIBED`：用户从 Skills 广场或团队推荐添加的 Skill。
- 个人 Skill 发布到广场后，不新增关系表字段；如果 `type = PERSONAL` 且 `skill_id != 0`，表示该个人 Skill 已关联公开 Skill。
- 卸载：只删除本地安装，不影响云端清单。
- 删除：删除“我的 Skill”里的云端关系或云端个人记录，并卸载本地安装。
- 删除提示文案：`删除云端数据，并卸载本地技能`。
- 卸载提示文案：`卸载本地技能，不影响云端数据`。
- 当前订阅场景暂不设计“取消订阅”独立状态；用户不想使用时，通过删除或不更新处理。

### 禁止事项

- 不要改动与本任务无关的 SMS/OAuth 代码和迁移。
- 不要把 desktop 加入 `scripts/services.sh`。
- 不要恢复复杂的桌面端一键启动脚本。
- 不要在 React 渲染进程直接访问 Node 文件系统；文件操作必须走 Electron preload 暴露的受控 API。
- 不要创建数据库外键；索引保持精简。
- 后端字段设计遵守当前规则：除 datetime/text 类型字段外，其他字段不能为空，并需要默认值。

## 并发实现建议

这些任务可以拆给多个 Agent，但不能完全无序并发。建议先确定安装数据模型和主进程 API 契约，再让页面、接口和打包任务并行。

### 建议执行顺序

1. 先做任务包 A：桌面本地能力基础。
2. 任务包 B 可以与任务包 A 并行，但两边需要先约定 `user_skills` 接口字段和 zip 下载方式。
3. 任务包 C 依赖任务包 A 的本地状态 API 和任务包 B 的接口契约。
4. 任务包 D 可独立并行，但真实发布验证应放在核心功能后。
5. 任务包 E 后置，等真实安装链路跑通后补体验和端到端验证。

### 任务包 A：桌面本地能力基础

范围：

- Electron 主进程下载、解压、扫描、删除本地 Skill。
- preload 暴露受控 API。
- 本地配置和安装记录从 localStorage 迁移到 Electron 本地 JSON 或 SQLite。
- 设置页安装目标路径真正参与安装/卸载/扫描。

主要文件：

- `desktop/electron/main.cts`
- `desktop/electron/preload.cts`
- `desktop/src/pages/localInstallStore.ts`
- `desktop/src/pages/DesktopSettingsPage.tsx`
- `desktop/src/pages/status.ts`

验收标准：

- 安装后能在配置目录看到真实 Skill 文件。
- 重启桌面端后仍能通过本地扫描识别已安装状态。
- 卸载后本地 Skill 目录被删除，云端清单不变。
- 删除时先删除云端关系，再卸载本地目录，失败时给出明确提示。
- `cd desktop && npm run lint` 通过。
- `cd desktop && npm run test -- src/pages/status.test.ts --run` 通过。

### 任务包 B：后端用户 Skill 接口补齐

范围：

- 补齐 `user_skills` 所需接口能力。
- 本地导入上传到云端。
- 广场添加到我的 Skill。
- 删除我的 Skill 云端关系。
- 明确 zip 下载字段来源，保证桌面端可以拿到可下载地址或可解析 storage key。

主要文件：

- `backend/src/main/java/com/skillstack/userskill/`
- `backend/src/main/java/com/skillstack/skill/`
- `backend/src/main/resources/db/migration/V29__user_skills.sql`
- `desktop/src/api/endpoints.ts`

验收标准：

- `GET /user-skills` 能返回个人和订阅 Skill。
- `POST /user-skills/import` 能创建或更新个人 Skill 云端记录。
- `POST /user-skills/subscribe` 能把公开 Skill 添加到我的 Skill。
- `DELETE /user-skills/{id}` 能删除用户自己的清单关系。
- 个人已发布 Skill 能通过 `skill_id != 0` 识别。
- 后端相关编译或测试通过。

### 任务包 C：桌面页面接入真实状态

范围：

- 我的 Skill 页面接入真实本地扫描结果和云端清单合并结果。
- Skills 广场添加后进入我的 Skill，并支持立即安装。
- 团队推荐接入真实推荐接口或明确后端暂缺时的占位边界。
- 一键更新/安装按真实安装能力逐项执行。

主要文件：

- `desktop/src/pages/MySkillsPage.tsx`
- `desktop/src/pages/PlazaPage.tsx`
- `desktop/src/pages/RecommendationsPage.tsx`
- `desktop/src/pages/status.ts`
- `desktop/src/api/endpoints.ts`

验收标准：

- 我的 Skill 能展示以下状态：
  - 个人：未安装 / 可安装到本地。
  - 个人：已安装 / 最新。
  - 个人：已安装 / 云端有更新。
  - 个人：已安装 / 云端已删除 / 本地保留，仍可用。
  - 订阅：已安装 / 最新。
  - 订阅：未安装 / 可安装到本地。
  - 订阅：已安装 / 可更新 / 本地 v0.8.0，云端 v0.9.0。
  - 订阅：已下架 / 本地保留，仍可用。
- 操作项使用图标，不使用大按钮。
- 顶部按钮只保留“本地导入”和“一键更新/安装”。
- 标签只保留“全部、可更新、未安装”。
- 页面文案使用“本地”，不使用“本机”。

### 任务包 D：打包与发布

范围：

- macOS 签名、公证和安装包验证。
- Windows/Linux 分平台打包验证。
- CI 分平台构建。
- 应用图标、安装包图标、版本号和产物命名。

主要文件：

- `desktop/package.json`
- 后续 CI 配置文件。
- 后续图标资源文件。

验收标准：

- macOS DMG 可安装、可启动、无白屏。
- Windows 至少在 Windows 环境验证 NSIS 安装包。
- Linux 至少在 Linux 环境验证 AppImage 或 deb。
- CI 不要求在本地一次完成，但需要给出可复现的构建命令和产物路径。

### 任务包 E：体验、错误处理和端到端验证

范围：

- 加载、空状态、错误状态细化。
- 登录失败、后端未启动、授权过期提示优化。
- 删除/卸载二次确认。
- 重新同步入口。
- 端到端验证脚本。

主要文件：

- `desktop/src/pages/`
- `desktop/src/api/client.ts`
- 后续 E2E 测试目录。

验收标准：

- 后端未启动时，不只展示 `Network Error`，需要给出可理解提示。
- 删除/卸载确认文案与已确认业务语义一致。
- 重新同步能刷新云端清单和本地扫描结果。
- 至少覆盖登录、添加、安装、更新、卸载、删除的基础验证路径。

## P0 真实安装链路

- [ ] 实现 Electron 主进程安装能力：下载 Skill zip、校验响应、解压到本地安装目录。
- [ ] 安装目标使用设置页配置，支持 Claude / Codex 目录，例如 `~/.claude/skills`、`~/.codex/skills`。
- [ ] 安装前检查目录是否存在、是否可写；不存在时给出创建或选择目录的处理方式。
- [ ] 安装成功后再写入本地安装记录，不能只依赖 localStorage 伪造“已安装”状态。
- [ ] 更新时覆盖旧版本目录，并保留必要的回滚/失败恢复策略。
- [ ] 卸载时删除本地目录，同时保留云端关系；删除时删除云端关系并卸载本地目录。
- [ ] 一键更新/安装需要逐项执行真实安装，并展示每项成功/失败结果。

## P0 本地状态读取

- [ ] 启动桌面端时扫描配置目录，识别本地已安装 Skill。
- [ ] 将本地扫描结果与云端 `user_skills` 清单合并，计算真实状态。
- [ ] 支持“云端已删除/已下架，本地保留仍可用”的状态从本地文件系统恢复。
- [ ] 本地安装记录建议从 localStorage 迁移到 Electron 本地 JSON 或 SQLite。

## P0 本地导入

- [ ] 实现“本地导入”按钮的文件选择能力，仅允许选择 Skill zip 或约定目录。
- [ ] 导入前解析 `SKILL.md` / 元数据，展示名称、版本、描述等预览。
- [ ] 调用后端上传接口，将个人 Skill 保存到云端 `user_skills`。
- [ ] 导入成功后根据用户选择决定是否立即安装到本地目录。
- [ ] 处理重复 slug、版本冲突、zip 不合法、缺少 `SKILL.md` 等错误。

## P1 设置与安装目标

- [ ] 设置页保存的 Agent 和安装路径需要真正被安装/卸载逻辑使用。
- [ ] 支持用户手动修改安装路径，并校验路径合法性。
- [ ] 显示当前设备、本地数据目录、安装目标等信息。
- [ ] 增加“打开安装目录”能力，方便用户确认文件落盘。

## P1 桌面端文件与权限能力

- [ ] 在 preload 中暴露受控 API，React 不能直接访问 Node 文件系统。
- [ ] 主进程 API 需要限制可写路径，避免任意路径写入风险。
- [ ] 下载、解压、删除操作需要统一错误码和前端提示。
- [ ] 增加安装日志，便于定位下载失败、解压失败、权限不足等问题。

## P1 广场与团队推荐闭环

- [ ] 广场“添加”后应进入我的 Skill，并允许立即安装。
- [ ] 团队推荐需要接入真实推荐接口；当前只是复用广场列表的占位实现。
- [ ] 已添加/已安装/可更新状态需要和真实本地扫描结果联动。

## P1 打包与发布

- [ ] macOS 安装包已能生成测试 DMG，但尚未做 Developer ID 签名和公证。
- [ ] Windows `nsis` 打包脚本已配置，但尚未在 Windows 环境验证。
- [ ] Linux `AppImage` / `deb` 打包脚本已配置，但尚未在 Linux 环境验证。
- [ ] 增加 CI 分平台构建：macOS 构建 DMG，Windows 构建 EXE，Linux 构建 AppImage/deb。
- [ ] 准备应用图标、安装包图标、应用名称、版本号和发布产物命名规范。

## P2 体验与健壮性

- [ ] 空状态、错误状态、加载状态需要按真实接口和真实安装结果细化。
- [ ] 删除/卸载需要二次确认，文案保持：删除云端数据，并卸载本地技能；卸载本地技能，不影响云端数据。
- [ ] 登录失败、授权过期、后端未启动时需要更明确提示，而不是只展示 `Network Error`。
- [ ] 增加“重新同步”入口，主动刷新云端清单和本地扫描结果。
- [ ] 增加基础端到端验证脚本，覆盖登录、添加、安装、更新、卸载、删除。
