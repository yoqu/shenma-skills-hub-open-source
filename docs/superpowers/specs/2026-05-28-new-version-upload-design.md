# 设计：发新版本时上传完整源文件

## 背景与问题

在「团队 / 我的提交」（`frontend/src/pages/team/member/MySubmissions/`）页面，作者对一个已发布的 Skill 点击「发新版本」时，当前的 `NewVersionModal` 只能填写**版本号**和**变更说明**，无法上传新的源文件。这导致发版只是元信息 bump，无法真正更新 Skill 的内容，是一个功能缺口。

后端其实已经完整支持携带新文件发版，缺口纯在前端。

## 现状（已确认）

- `POST /api/skills/{id}/versions`（`SubmitVersionReq`）已接受可选字段 `zipUrl`（已上传到 storage 的 zip key），service 层（`SkillService.submitVersion` → 直发 `publishVersionDirectly` / 审核 `Review.zipUrl`）和审核通过路径（`ReviewService` VERSION_BUMP → `materializeQuietly`）都已消费 `zipUrl`。
- 三个上传 endpoint 已存在并可用，均返回 `{ zipUrl, url }`：
  - `skillApi.uploadVersionZip(file)` → `/skills/versions/upload`
  - `skillApi.uploadVersionMd(file)` → `/skills/versions/upload-md`（服务端把 `.md` 包成 zip）
  - `skillApi.uploadVersionText(content)` → `/skills/versions/upload-text`（把粘贴文本包成 zip）
- `skillApi.parseVersionZip(zipUrl)` → `SkillParseResult`，其中 `parsed.version`（`string | null`）来自 SKILL.md frontmatter，`checks` / `ok` / `hasSkillMd` / `hasFrontmatter` 描述解析校验结果。
- 创建向导的 `frontend/src/pages/create/CreateSkill/Step1.tsx`（`Step1Upload`）是三种上传方式的参考实现；`Step2.tsx`（`Step2Parse`）是解析的参考实现。
- 前端 `submitVersionMutation`（`MySubmissions/index.tsx`）当前只传 `{ version, changelog }`，从不传 `zipUrl`。
- 项目中**没有**现成的 semver 比较工具；`NewVersionModal` 内已有一个本地 `bumpHint` 做基础正则解析。

## 范围

- **纯前端改动。** 不改后端、不改 DB、不改 migration。
- **不重构 `Step1Upload`。** 两个使用场景（向导大尺寸拖拽区 vs 弹窗紧凑布局）视觉差异大，且创建流程已稳定工作，改它会引入回归风险。复用点是 API client（两边本就共用），不是 UI 组件。

## 产品决策（已和用户确认）

1. **上传源文件为必填。** 每次发新版本都必须上传新的 zip / md / text，不允许只改元信息。
2. **版本号自动回填 + 必须递增。** 上传成功后解析 frontmatter，把 `parsed.version` 预填到版本号输入框（作者可改）。提交时校验新版本号必须严格高于当前版本：相等或更低都报错。

## 详细设计

### 1. `NewVersionModal` 增加必填上传区

文件：`frontend/src/pages/team/member/MySubmissions/NewVersionModal.tsx`

- 新增一个**紧凑版**三选一 tab：`上传压缩包`（`.zip`）/ `上传 SKILL.md`（`.md`）/ `粘贴文本`，尺寸适配弹窗（不用向导里 48px padding 的大拖拽区）。
- 直接复用现有 API：`skillApi.uploadVersionZip / uploadVersionMd / uploadVersionText`，用 `useMutation` 包装（参照 `Step1Upload` 的三个 mutation 写法）。
- 上传成功后在组件内持有 `{ zipUrl, kind, fileName, size }`，并展示一个紧凑的「已就绪」确认行 + `重新选择` 按钮（重选会清空已上传状态与解析结果）。
- 文件大小 / 后缀校验沿用 `Step1Upload` 的规则：zip ≤ 20MB 且 `.zip`；md ≤ 256KB 且 `.md`；text 非空且 ≤ 256KB。
- 切换 tab 若已有上传内容则清空（避免 UI 错位），与 `Step1Upload.switchMode` 行为一致。

### 2. 解析与版本号自动回填

- 上传成功后调用 `skillApi.parseVersionZip(zipUrl)`。
- 若 `parsed.version` 有值：当版本号输入框为空（作者尚未手动改过）时，自动预填该值。作者可继续编辑。
- 若 `parsed.version` 为 `null`（如纯文本无 version、或解析失败）：不回填，作者手动输入。
- 解析返回的 `checks` 中若存在 `error`/`warn`（如缺 SKILL.md、缺 frontmatter）：在弹窗内以**警告**形式提示，但**不硬性阻止提交**——既有审核 / materialize 路径会兜底处理，硬阻止会扩大范围。（用户已认可此点。）

### 3. 版本号校验（新增 `compareSemver` 本地 helper）

在 `NewVersionModal.tsx` 内新增 `compareSemver(a, b)`（与 `bumpHint` 一样本地，因为只有此处消费）。返回 -1 / 0 / 1，仅支持 `major.minor.patch` 纯数字三段。

提交时校验顺序：

- 未上传源文件 → `请上传新版本的源文件`
- 版本号为空 → `请输入新版本号`
- 版本号长度 > 32 → `版本号过长`
- 等于当前版本 → `新版本号不能与当前版本相同`
- 当前版本与新版本都是合法 semver 且新版本 < 当前版本 → `新版本号必须高于当前版本 v{current}`
- 任一不是合法 semver → 回退为仅「不相等」校验（不做大小比较）
- changelog 长度 > 1024 → `变更说明过长（上限 1024 字）`

### 4. 数据贯通

- `NewVersionModal` 的 `onSubmit` 回调签名从 `{ version, changelog }` 改为 `{ version, changelog, zipUrl }`。
- `MySubmissions/index.tsx`：
  - `submitVersionMutation` 的入参类型增加 `zipUrl: string`，`mutationFn` 改为 `skillApi.submitVersion(skillId, { version, changelog, zipUrl })`。
  - 渲染 `NewVersionModal` 处的 `onSubmit` 把 `zipUrl` 一并透传给 mutation。

## 边界与状态处理

- **loading**：上传中、解析中分别禁用对应交互；提交按钮在 `submitting` 时禁用并显示「提交中…」。
- **error**：上传失败、解析失败、校验失败都在弹窗内以红色错误条展示（沿用现有 error UI）。
- **empty**：未上传时提交按钮不可点（或点击后报「请上传新版本的源文件」）。
- **关闭弹窗**：上传或提交进行中不允许关闭（沿用现有 `submitting` 守卫，扩展为覆盖上传/解析进行中）。

## 不做的事（YAGNI）

- 不重构 `Step1Upload` 为共享组件。
- 不抽取全局 semver 工具库。
- 不改后端、DB、migration。
- 不在弹窗里展示完整的 `Step2Parse` 校验清单 UI，只做轻量警告提示。
- 不做版本号「自动建议下一个补丁号」之外的额外 bump 策略（保留现有 `bumpHint` 提示）。

## 验证方式

- `cd frontend && npm run lint`（tsc 类型检查）
- `cd frontend && npm run build`
- 浏览器 smoke：登录 → 团队 / 我的提交 → 对一个已 APPROVED 的 Skill 点「发新版本」→ 分别用 zip / md / text 三种方式上传 → 确认版本号自动回填、低版本/同版本被拦截、changelog 选填、提交成功后出现在审核队列且新版本携带新内容。
