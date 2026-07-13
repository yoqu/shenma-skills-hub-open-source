# Skill / Prompt 自定义上传图标 — 设计

日期：2026-05-29
状态：设计已确认，待写实现计划

## 背景与目标

当前创建 Skill / Prompt 时无法自定义图标：

- **Skill**：`skills.icon`（`VARCHAR(8)`）只在创建时自动填名称首字母（`name.slice(0,1)`），没有 UI 可设置；卡片展示走「分类图 → 字母兜底」。
- **Prompt**：完全没有 icon（无列、无字段、无 DTO），卡片固定渲染 `</>` code 图标。

目标：让用户在**创建**和**编辑/管理已上线资产**时，都能为 Skill / Prompt 上传一张自定义图片作为图标。图标可选，未设置时维持现有兜底。

## 核心约定：存储与数据流

遵守 AGENT.md 的「存储 URL 铁律」——DB 存 raw storage key，对外返回完整 URL，前端用 `<img>` 渲染。

现有 `skills.icon`（`VARCHAR(8)`）装不下 storage key，因此**新增独立列**，与现有字符兜底共存，不改老列：

| 实体 | 新增列 | 现有兜底 | 展示优先级 |
|------|--------|----------|-----------|
| `skills` | `icon_url VARCHAR(512)`（raw key） | 老列 `icon`（首字母）/ 分类图 | 上传图 → 分类图 → 字母 |
| `prompts` | `icon_url VARCHAR(512)`（raw key） | 固定 `</>` code 图标 | 上传图 → code 图标 |

规则：

- DB 列落 **raw key**；对外 DTO 字段命名 `iconUrl`，经 `StorageUrlResolver.resolveSingle()` 解析成完整 URL。
- Entity 的 `iconUrl` 字段保持 **raw key，不挂 `StorageUrlTypeHandler`**，以便编辑替换时 `storageService.delete(oldKey)` 清理旧文件（与 `User.avatarUrl` 同理）。
- 两张表的列均用**新时间戳 migration**（`V20260529_HHMMSS__add_icon_url.sql`），不改历史 migration。

## 上传端点

镜像现有 `POST /api/skills/description-images`，但**返回 `{ key, url }` 两个值**（描述图只返回 url；图标需要 key 才能落库为 raw key）：

- `POST /api/skills/icon-images` → 存 `skill-icons/{userId}/`，返回 `{ key, url }`
- `POST /api/prompts/icon-images` → 存 `prompt-icons/{userId}/`，返回 `{ key, url }`

校验复用现有规则：`contentType` 以 `image/` 开头、非空、≤ 2MB（与头像一致）。两端点逻辑仅前缀不同，抽一个小私有方法复用，避免重复。

## 前端

### 展示组件

- **`SkillIcon`**：新增可选 `url?: string`。有 `url` → 渲染 `<img>`（沿用现有圆角容器 + `objectFit: 'cover'`）；否则走现有「分类图 / 字母」逻辑。所有调用处补传 `url={skill.iconUrl}`（`components/ui/SkillCard.tsx`、`components/atoms/SkillCard.tsx`、Step4 预览、Skill 详情页等）。
- **`PromptCard`**：有 `prompt.iconUrl` → 渲染 `<img>`；否则保留现有 `</>` 兜底盒子。

### 新增 `IconUpload` 组件

方形圆角（区别于圆形 `AvatarUpload`），供 CreateSkill / CreatePrompt 共用：

- props：`currentUrl?`、`uploading` 状态、`onUploaded(key, url)`、`onClear()`、`upload(file) => Promise<{key,url}>`（由调用方注入对应端点）。
- 行为：本地即时预览 → 上传 → 回调 `key`（存表单）与 `url`（预览）；支持「移除」回退默认；类型/大小校验失败显示错误、不阻塞表单。

### 表单接线

- **CreateSkill**：`SkillMeta` 增 `iconKey?` + `iconUrl?`（预览用）；Step3 加 `IconUpload`；Step4 `buildPayload` 增 `iconKey`，原 `icon: 首字母` 作为字符兜底保留。
- **CreatePrompt**：`PromptForm` 增 `iconKey?` + `iconUrl?`；表单加 `IconUpload`；`create` payload 带 `iconKey`。
- **编辑/Profile 流**：`skillApi` / `promptApi` 的 profile 更新请求增 `iconKey`；编辑页加载时回填已存在的 `iconUrl` 作为预览。
- 前端 `api/data` 中 SkillCard / SkillDetail / PromptCard / PromptDetail 类型增 `iconUrl?: string`。

## 后端

### Skill

- `CreateSkillReq`、`AdminSkillProfileUpdateReq` 增 `iconKey`。
- `Skill` entity 增 `iconUrl`（raw key，无 TypeHandler）。
- `createDirect` / `updateAdminProfile` 写入 `s.setIconUrl(req.getIconKey())`；`updateAdminProfile` 替换时若新旧 key 不同，`storageService.delete(oldKey)`。
- `SkillMapper` 的 `selectPublicSkills` / `selectDetailBySlug` SELECT 补 `s.icon_url`；service 装配 DTO 时 `resolver.resolveSingle(iconUrlKey)` → DTO `iconUrl`。

### Prompt

- `CreatePromptReq`、`AdminPromptProfileUpdateReq`、`PromptPayload`、`PromptCard`、`PromptDetail` 增 icon 字段（请求/payload 为 `iconKey`，对外 DTO 为 `iconUrl`）。
- `Prompt` entity 增 `iconUrl`（raw key）。
- `publishNew` / `updateAdminProfile` 写入；`updateAdminProfile` 替换时删旧 key。
- `PromptMapper` 已用 `p.*`（新列自动带出）；service 装配 DTO 时解析 `iconUrl`。

### 审核流（关键）

走审核（非直接发布）时，icon key 必须随 `payloadJson` 落库，并在 approve / resubmit 时回放，否则审核通过后上传的图标会丢：

- **Skill**：`ReviewPayloadReq` / 写入与重建审核 payload 的路径串入 `iconKey`。
- **Prompt**：`PromptPayload` 增 `icon`（key）；`writePayload` / `parsePayload` / `approveReview` / resubmit 的 `applyPayload` 全链路携带。

## 边界 / 兜底

- 图标可选；不传维持现有兜底（skill 字母/分类图、prompt code 图标）。
- 上传校验失败、图片加载失败时回退兜底，不阻塞提交。
- create 流程中重复上传产生的孤儿文件，与现有描述图行为一致，暂不主动清理；仅**编辑替换**时删旧文件。

## 验证

- 后端：`cd backend && mvn -q -DskipTests compile`；涉及 service 改动跑 `mvn test`。
- 前端：`cd frontend && npm run lint && npm run build`。
- Smoke：创建 Skill/Prompt 上传图标 → 卡片/详情显示图片；编辑替换图标 → 旧文件删除、新图显示；审核模式下提交→通过后图标保留；不传图标→兜底正常。

## 不做（YAGNI）

- 不做 emoji / 内置图标库选择器（本次只做上传图片）。
- 不做图标裁剪 / 编辑器。
- 不做 create 流程孤儿文件的主动清理。
