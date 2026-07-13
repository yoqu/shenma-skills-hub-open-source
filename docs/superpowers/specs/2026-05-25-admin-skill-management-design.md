# 后台 Skill 管理增强设计

- 日期：2026-05-25
- 状态：Draft
- 范围：管理后台 Skill 库、Skill 元信息维护、已上线 Skill 更新版本
- 目标用户：团队 OWNER / ADMIN，以及具备提交权限的普通成员

## 1. 背景

当前后台 `team/admin/Skills.tsx` 已经能管理团队 Skill 库中的已上线资产，支持：

- 列表、搜索、状态筛选、分类筛选、作者筛选、更新时间筛选
- 可见性切换：`PUBLIC` / `TEAM_PRIVATE`
- 状态切换：`APPROVED` / `UNLISTED`
- 删除

但已上线 Skill 无法在后台快速完成两类高频维护动作：

1. 修正描述、分类、标签、图标等展示元信息；
2. 更新 Skill 内容或上传新版本。

这会导致管理员只能通过创建/提交流程绕行，维护成本高，也不符合“后台快速管理团队资产”的定位。

## 2. 目标

1. 管理员可以在后台直接编辑已上线 Skill 的展示元信息。
2. 管理员可以在后台提交新版本并绕过审核直接发布。
3. 非管理员更新版本时，仍按团队审核设置决定是否进入审核。
4. 复用现有上传、解析、版本、审核链路，避免新增一套并行发布机制。
5. 后台列表操作完成后，列表与详情页数据及时刷新。

## 3. 非目标

- 不新增复杂批量编辑。
- 不新增版本回滚。
- 不新增 slug 修改能力。
- 不重做 Skill 创建流程。
- 不改变 `skills` 表只承载 `APPROVED / UNLISTED` 已上线资产的定位。
- 不让普通成员获得管理员级元信息直改权限。

## 4. 角色与发布规则

### 4.1 角色定义

- 管理员：`teamAccessGuard.requireWriter(teamId, userId)` 通过的用户，即团队 OWNER / ADMIN。
- 非管理员：团队成员，但不是 writer。
- 非成员：无权在后台管理 Skill。

### 4.2 元信息编辑

仅管理员允许直接编辑已上线 Skill 元信息。

允许字段：

| 字段 | 说明 |
|---|---|
| `name` | 展示名称 |
| `shortDesc` | 简短描述 |
| `cat` | 分类 code |
| `tags` | 标签列表 |
| `icon` | 图标字符 |
| `visibility` | `PUBLIC` / `TEAM_PRIVATE`，可复用现有能力 |

禁止字段：

| 字段 | 原因 |
|---|---|
| `slug` | 影响详情页、下载链接、CLI 引用，第一期不开放 |
| `version` | 只能通过版本更新链路修改 |
| `zipUrl` | 只能通过版本更新链路修改 |
| `status` | 继续使用上下架接口 |
| `authorId` | 继续使用转移作者接口 |

### 4.3 版本更新

版本更新入口对管理员和普通成员都可见，但提交后的行为不同：

| 用户 | 团队 `reviewMode` | 行为 |
|---|---|---|
| 管理员 | 任意 | 绕过审核，直接发布新版本 |
| 非管理员 | `DIRECT_PUBLISH` | 直接发布新版本 |
| 非管理员 | `REVIEW_REQUIRED` | 创建 `VERSION_BUMP` 审核记录，等待管理员审核 |

管理员绕过审核时仍需要写入版本历史、解析文件索引、记录 activity，不能只改 `skills.version`。

## 5. 后端设计

### 5.1 新增 DTO：`AdminSkillProfileUpdateReq`

位置：

```text
backend/src/main/java/com/skillstack/skill/dto/AdminSkillProfileUpdateReq.java
```

字段：

```java
private String name;
private String shortDesc;
private String cat;
private String icon;
private String visibility;
private List<String> tags;
```

校验：

- `name`：1 到 80 字符
- `shortDesc`：1 到 200 字符
- `cat`：必须存在于分类表
- `icon`：允许为空，非空时不超过 8 字符
- `visibility`：仅允许 `PUBLIC` / `TEAM_PRIVATE`
- `tags`：最多 8 个，单个 1 到 32 字符，去重后保存

### 5.2 新增接口：编辑元信息

```http
PATCH /api/skills/{id}/admin-profile
```

权限：

- 读取 skill；
- `teamAccessGuard.requireWriter(skill.teamId, operatorId)`；
- 仅允许 `APPROVED / UNLISTED`。

行为：

1. 校验字段。
2. 更新 `skills.name / short_desc / cat_code / icon / visibility / updated_at`。
3. 重建 `skill_tag` 关联。
4. 返回最新 `SkillCard` 或 `Void`。

推荐返回最新 `SkillCard`，前端可局部更新；若实现成本更低，也可返回 `Void` 并 invalidate 列表。

### 5.3 调整接口：提交新版本

现有接口：

```http
POST /api/skills/{id}/versions
```

现有入参：

```json
{
  "version": "1.2.0",
  "changelog": "更新说明",
  "zipUrl": "skill-versions/..."
}
```

需要调整 `SkillService.submitVersion(...)` 的分支：

1. 读取 Skill，确认 Skill 存在且未删除。
2. 确认操作者是团队成员或作者；管理员通过 `requireWriter` 判定。
3. 版本号必须非空，且不能等于当前版本。
4. `zipUrl` 若提供，必须来自当前用户上传目录。
5. 判断发布策略：
   - 管理员：直接发布；
   - 非管理员 + `DIRECT_PUBLISH`：直接发布；
   - 非管理员 + `REVIEW_REQUIRED`：创建 `reviews.kind='VERSION_BUMP'`。

### 5.4 直接发布版本的服务方法

新增内部方法，例如：

```java
publishVersionDirectly(Skill skill, Long operatorId, SubmitVersionReq req)
```

事务内执行：

1. 插入 `skill_versions` 历史行，写入 `version / changelog / zip_url / safety / eval_score / files_count`。
2. 调用 `SkillVersionFileService.materialize(...)` 建立文件索引；失败时记录 warn，不阻塞发布。
3. 更新 `skills.version = req.version`、`skills.updated_at = now()`，若原状态是 `UNLISTED` 则保持下架状态。
4. 写 activity：管理员发布新版本 / 成员直接发布新版本。
5. 返回 `CreateSkillRes`，`pendingReview=false`。

约束：

- 直接发布不创建 `reviews` 行，避免审核队列出现“已绕过”的假待办。
- 如果需要审计，后续可新增 audit log；第一期用 activity 满足可见追踪。

### 5.5 审核路径保持

非管理员在 `REVIEW_REQUIRED` 团队提交新版本时，继续创建：

```text
reviews.kind = VERSION_BUMP
reviews.status = PENDING_REVIEW
reviews.skill_id = skill.id
```

审核通过时沿用 `ReviewService.approve` 的 `VERSION_BUMP` 物化逻辑。

审核拒绝、要求修改、撤回时，不得改变已上线 Skill 当前版本和状态。

## 6. 前端设计

### 6.1 后台 Skill 列表行菜单

在 `frontend/src/pages/team/admin/Skills.tsx` 的 `RowMenu` 中新增：

- `编辑信息`
- `提交新版本`

建议顺序：

```text
编辑信息
提交新版本
改为公开 / 改为团队私有
下架 / 重新上架
删除
```

点击行本身仍进入详情页；点击菜单项必须 `stopPropagation`。

### 6.2 `SkillEditDrawer`

新增组件：

```text
frontend/src/pages/team/admin/Skills/SkillEditDrawer.tsx
```

交互：

- 右侧 drawer 打开；
- 顶部显示 Skill 名称、当前版本、状态 badge；
- 表单字段：名称、描述、分类、标签、图标、可见性；
- 保存按钮在 mutation 中显示 loading；
- 保存成功 toast：`已更新 Skill 信息`；
- 保存失败展示后端错误；
- 保存成功后 invalidate `['team-skills', teamId]`。

移动端：

- drawer 在窄屏退化为全屏 modal；
- 表单字段纵向排列，按钮固定底部。

### 6.3 `AdminSubmitVersionModal`

新增组件：

```text
frontend/src/pages/team/admin/Skills/AdminSubmitVersionModal.tsx
```

复用创建流程已有能力：

- `.zip` 上传：`skillApi.uploadVersionZip`
- `.md` 上传：`skillApi.uploadVersionMd`
- 粘贴文本：`skillApi.uploadVersionText`
- 解析：`skillApi.parseVersionZip`
- 提交：`skillApi.submitVersion`

表单字段：

| 字段 | 说明 |
|---|---|
| 上传方式 | zip / SKILL.md / 粘贴 |
| `version` | 默认可从解析结果带出 |
| `changelog` | 必填，最多 1024 字 |
| 解析摘要 | name、description、tags、文件校验 |

管理员提示文案：

```text
你是团队管理员，本次更新会绕过审核并直接发布。
```

非管理员提示文案：

```text
团队当前需要审核，本次更新会提交到审核队列。
```

若团队为 `DIRECT_PUBLISH`：

```text
团队当前允许直接发布，本次更新会立即上线。
```

提交成功后：

- 直接发布：toast `新版本已发布`，刷新后台 Skill 列表；
- 进入审核：toast `新版本已提交审核`，可跳转 `MySubmissions` 或审核详情。

### 6.4 API client

`frontend/src/api/endpoints.ts` 新增：

```ts
updateAdminProfile: (
  id: number,
  body: {
    name: string;
    shortDesc: string;
    cat: string;
    icon?: string;
    visibility: 'PUBLIC' | 'TEAM_PRIVATE';
    tags: string[];
  },
) => http.patch<unknown, Skill>(`/skills/${id}/admin-profile`, body)
```

现有 `submitVersion` 继续使用。

### 6.5 数据刷新

直接发布或编辑元信息后需要 invalidate：

- `['team-skills', teamId]`
- Skill 详情 query，如果当前页面已有缓存，按 slug invalidate
- versions query，如果提交新版本成功

## 7. 数据一致性与边界

### 7.1 `UNLISTED` Skill 更新

已下架 Skill 允许更新元信息和版本。

直接发布新版本后保持 `UNLISTED`，不自动重新上架。

### 7.2 版本号冲突

同一个 Skill 下不允许重复 `version`。

后端在插入 `skill_versions` 前校验；数据库唯一约束若已存在则兜底。

### 7.3 zip 权限

`zipUrl` 必须来自当前登录用户的上传目录：

```text
skill-versions/{userId}/...
```

管理员不能直接引用别人的临时上传 key。

### 7.4 标签更新

元信息编辑中的 tags 更新只影响当前 Skill 展示标签，不影响历史版本。

版本更新解析出的 tags 不自动覆盖 Skill 元信息，除非用户在 modal 中显式勾选“同步解析出的标签”。第一期建议不做该勾选，避免更新版本时意外改展示信息。

## 8. 验收标准

### 8.1 管理员编辑元信息

1. 管理员进入后台 Skill 库，点击某个 `APPROVED` Skill 的 `编辑信息`。
2. 修改描述并保存。
3. 后台列表展示新描述。
4. Skill 详情页展示新描述。
5. 普通成员调用该接口返回 403。

### 8.2 管理员直接发布新版本

1. 管理员在后台点击 `提交新版本`。
2. 上传或粘贴新的 `SKILL.md`，填写新版本号和 changelog。
3. 提交后提示 `新版本已发布`。
4. Skill 列表版本号立即更新。
5. Skill 详情页版本历史出现新版本。
6. 审核队列不新增待审记录。

### 8.3 非管理员按团队设置更新

1. 团队为 `REVIEW_REQUIRED` 时，普通成员提交新版本后进入审核队列，Skill 当前版本不变。
2. 团队为 `DIRECT_PUBLISH` 时，普通成员提交新版本后直接上线。
3. 审核拒绝非管理员版本更新时，已上线 Skill 当前版本和状态不变。

### 8.4 下架 Skill 更新

1. 管理员对 `UNLISTED` Skill 提交新版本。
2. 版本号更新成功。
3. Skill 状态仍是 `UNLISTED`。

## 9. 测试计划

后端：

```bash
cd backend
mvn test -Dtest=SkillControllerTest,SkillServiceTest,ReviewServiceTest
```

重点用例：

- `adminCanUpdateSkillProfile`
- `memberCannotUpdateSkillProfile`
- `adminSubmitVersionPublishesDirectly`
- `memberSubmitVersionRequiresReviewWhenTeamReviewRequired`
- `memberSubmitVersionPublishesWhenTeamDirectPublish`
- `directVersionPublishKeepsUnlistedStatus`

前端：

```bash
cd frontend
npm run lint
npm run build
```

浏览器 smoke：

- 登录管理员账号；
- 打开 `/team/skills`；
- 编辑描述；
- 提交新版本；
- 打开 `/skills/:slug` 确认描述、版本、版本历史；
- 切换普通成员账号验证审核策略。

## 10. 实施切分

### Step 1：后端元信息编辑

- 新增 `AdminSkillProfileUpdateReq`
- 新增 `PATCH /api/skills/{id}/admin-profile`
- 新增 service 方法与权限校验
- 增加单元/控制器测试

### Step 2：后端版本更新策略

- 调整 `submitVersion`
- 增加管理员绕审直接发布分支
- 保留非管理员按 `reviewMode` 分流
- 覆盖版本历史、文件索引、activity、`UNLISTED` 保持

### Step 3：前端编辑信息

- 新增 `SkillEditDrawer`
- 行菜单接入
- API client 接入
- 列表/详情缓存刷新

### Step 4：前端提交新版本

- 新增 `AdminSubmitVersionModal`
- 复用上传/解析接口
- 按角色和团队设置展示发布结果提示
- 成功后刷新列表和版本数据

### Step 5：端到端验证

- 后端测试
- 前端 lint/build
- 管理员与普通成员浏览器 smoke

## 11. 开放问题

1. `name` 是否允许修改后同步影响搜索权重或 activity 文案？第一期只更新当前展示和搜索查询字段。
2. 管理员直接发布是否需要专门 audit log？第一期用 activity 记录，后续若后台需要审计页再扩展。
3. 版本更新 modal 是否允许“只改 changelog 不上传文件”？第一期建议要求上传内容或提供 `zipUrl`，避免产生没有文件来源的新版本。
