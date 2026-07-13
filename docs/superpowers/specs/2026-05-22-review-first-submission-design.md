# Review-First Submission 设计

- 日期：2026-05-22
- 作者：yoqu（与 Claude 协作）
- 状态：草案，待实现
- 影响范围：backend（skill / review 模块）+ frontend（team admin / team member / create / account）+ 数据库 migration（V15）

## 1. 背景与问题

当前流程下，无论团队 review 模式是什么，作者点击"提交"时 `SkillService.create()` 都会：

1. 向 `skills` 表写入一行（status 为 `DRAFT / PENDING_REVIEW / APPROVED` 之一）；
2. 当团队为 REVIEW 模式且非草稿时，再向 `reviews` 表插入一行镜像审核记录。

结果是：

- `team/admin/Skills.tsx` 与团队成员 Dashboard 都能看到 `PENDING_REVIEW / REJECTED / DRAFT` 状态的 skill。
- 同一笔提交在"团队 Skill 库"和"审核队列 / MySubmissions"出现两遍。
- 业务定位错位："Skill 库"承担了它本不应承担的"工单台账"职责。

用户诉求："审核模式下不应直接写入 skill 库，而是先进入审核表，审核通过后才进入 skill 库。"

## 2. 设计目标

1. **Skill 库 = 已发布的团队资产**：只装 `APPROVED / UNLISTED`。
2. **reviews 表 = 提交事务**：承载 `DRAFT / PENDING_REVIEW / CHANGES_REQUESTED / REJECTED / WITHDRAWN` 的完整生命周期。
3. **作者体验不退化**：草稿可编辑、驳回可原地修改后重新提交。
4. **不影响 DIRECT_PUBLISH 模式**：非草稿提交仍直接物化为 APPROVED skill（无 review 行）。
5. **顺手修复 version-bump 被拒后回退 skill 状态的隐性 bug**：已上线的 skill 不应因新版本被拒而被打回 DRAFT/REJECTED。

## 3. 数据模型

### 3.1 reviews 表扩列（migration V15）

新增列：

| 列 | 类型 | 说明 |
|---|---|---|
| `cat_code`   | VARCHAR(64)   | 分类 code，approve 时复制到 `skills.cat_code` |
| `icon`       | VARCHAR(64)   | 图标，approve 时复制到 `skills.icon` |
| `langs_json` | VARCHAR(256)  | 语言数组 JSON 快照 |
| `tags_json`  | VARCHAR(1024) | 标签数组 JSON 快照（仅审核期使用，approve 时才注册到 `tags` + 建 `skill_tag`） |
| `kind`       | VARCHAR(16) NOT NULL DEFAULT 'CREATE' | `CREATE` 或 `VERSION_BUMP`，分流 approve 物化逻辑 |

约束：

- `kind='CREATE'` 期间 `skill_id` 为 NULL；approve 成功后回填新建 skill 的 id。
- `kind='VERSION_BUMP'` 时 `skill_id` 始终指向既有 skill，行为与现状一致。
- 不在 DB 建 partial unique index（MySQL 不支持），slug 唯一性在应用层校验。

### 3.2 SubmissionPayload 概念

一条 review 行 = "submission payload + 审核流程状态"。审核结束（approve）时，该行包含足以无依赖物化出一条完整 skill 的全部字段：slug, name, short_desc, cat_code, icon, version, visibility, langs_json, tags_json, safety, eval_score, files_count, zip_url, submitter_id, team_id。

### 3.3 skills 表语义收窄

`skills.status` 只允许取值 `APPROVED / UNLISTED`。注释更新；保留 `DRAFT/PENDING_REVIEW/REJECTED/CHANGES_REQUESTED` 枚举值用于历史数据兼容与防御性兜底，但新写入不再使用。

### 3.4 slug 唯一性规则

提交 / resubmit / approve 时校验：

```text
slug 不允许同时存在于：
  - skills.slug（任何 status，含软删除？不含——deleted=1 视为释放）
  - reviews.slug WHERE kind='CREATE' AND status IN (DRAFT, PENDING_REVIEW, CHANGES_REQUESTED)
```

REJECTED / WITHDRAWN 的 review 自动释放 slug。

## 4. 状态机

### 4.1 kind='CREATE'

```text
                          ┌── reject ────────► REJECTED ──┐
                          │                               │
DRAFT ──submit──► PENDING_REVIEW ──approve──► (物化 skills + skill_versions + skill_tag,
  ▲                       │                              review.status=APPROVED,
  │                       │                              review.skill_id=new_id)
  │                       ├── request-changes ──► CHANGES_REQUESTED
  │                       │                               │
  │                       └── withdraw ──► WITHDRAWN      │
  │                                                       │
  └──── edit (PATCH) ◄──── (REJECTED / CHANGES_REQUESTED / WITHDRAWN 可编辑后再 resubmit) ───┘
        resubmit ──► PENDING_REVIEW
```

reject / request-changes / withdraw **不再回写 skills.status**（kind='CREATE' 期间根本没有 skills 行）。

### 4.2 kind='VERSION_BUMP'

维持现有状态机；但 reject / request-changes / withdraw 不再把 skills.status 从 APPROVED 回退到 DRAFT/REJECTED/PENDING_REVIEW。已上线版本保持 APPROVED 不受未通过的新版本影响。approve 时仍 `update skill.version + insert skill_versions` 一条历史行。

## 5. Submit 路径

### 5.1 入口：`POST /api/skills`（CreateSkillReq）

后端内部分流：

```text
team.reviewMode == DIRECT_PUBLISH && !draft
  → 老路径：直接物化 skills (status=APPROVED) + 初始 skill_versions + skill_tag

其它（REVIEW 模式 或 draft=true）
  → 新路径：仅插入 reviews 行，kind='CREATE', skill_id=NULL
      draft=true  → status=DRAFT
      draft=false → status=PENDING_REVIEW, submitted_at=now()
      携带完整 payload（含 cat_code/icon/langs_json/tags_json）
```

返回结构（`CreateSkillRes`）保留 `slug / status / pendingReview` 字段；新增 `reviewId`（可选）以便前端跳转 MySubmissions 详情。

### 5.2 新增/扩展的 review 端点（`/api/reviews`）

| 方法 / 路径 | 权限 | 行为 |
|---|---|---|
| `PATCH /api/reviews/:id` | review.submitter 本人 | 编辑 payload；只在 status ∈ {DRAFT, REJECTED, CHANGES_REQUESTED, WITHDRAWN} 时允许 |
| `POST /api/reviews/:id/submit` | submitter | DRAFT → PENDING_REVIEW（再次跑 slug 唯一性校验） |
| `POST /api/reviews/:id/resubmit` | submitter | CHANGES_REQUESTED / REJECTED / WITHDRAWN → PENDING_REVIEW（可同时携带 payload 改动） |
| `POST /api/reviews/:id/withdraw` | submitter | PENDING_REVIEW → WITHDRAWN（已存在，行为不变） |
| `DELETE /api/reviews/:id` | submitter | 删除自己处于 DRAFT / REJECTED / WITHDRAWN 的记录（PENDING_REVIEW / CHANGES_REQUESTED 不允许删） |

### 5.3 "我的草稿" 数据源切换

- 旧：`GET /api/skills/drafts` → `SELECT * FROM skills WHERE author_id=me AND status='DRAFT'`
- 新：同一 URL，内部读 `SELECT * FROM reviews WHERE submitter_id=me AND kind='CREATE' AND status='DRAFT'`

### 5.4 "发新版本" 路径

不变：`SkillService.submitVersion` 仍为基于已 APPROVED 的 skill 创建 `kind='VERSION_BUMP'` 的 review。

## 6. approve 时的"物化"

`ReviewService.approve` 重写为单事务执行：

```text
1. 校验 review.status ∈ {PENDING_REVIEW, CHANGES_REQUESTED}
2. 再次校验 slug 唯一（against skills.slug，防止决策期间被别处占用）
3. 若 kind='CREATE'：
   a) INSERT skills (slug, name, short_desc, cat_code, icon, version, visibility,
                     status='APPROVED', author_id=submitter_id, team_id,
                     installs=0, stars=0, score=0, safety, eval_score, langs,
                     published_at=now())
   b) 解析 tags_json → ensureTag() → INSERT skill_tag
   c) INSERT skill_versions（初始版本，复制 zip_url/files_count/safety/eval_score）
   d) UPDATE reviews SET skill_id=新 id, status='APPROVED', reviewer_id, decided_at
4. 若 kind='VERSION_BUMP'：
   - UPDATE skills.version
   - INSERT skill_versions 历史行（含 changelog/zip_url 等）
   - UPDATE review.status='APPROVED', reviewer_id, decided_at
5. 写 activity（与现状对齐）
```

事务隔离：slug 冲突或唯一索引冲突抛 `BusinessException`，整体回滚。

## 7. 前端影响面

### 7.1 页面级改造

| 页面 | 改造 |
|---|---|
| `team/admin/Skills.tsx` | 删除 `PENDING_REVIEW / REJECTED / DRAFT` tab；保留：全部（APPROVED+UNLISTED）/ 已发布 / 已下架。数量统计同步 |
| `team/admin/Dashboard.tsx` | 待审核数本来就从 reviews 取，不变 |
| `team/admin/Reviews.tsx` / `Reviews/ReviewList.tsx` / `ReviewPane.tsx` | 数据源不变；详情里"跳转 skill 详情"链接对未物化 skill 不展示 |
| `team/member/Dashboard.tsx` | 个人待审/已拒计数改为读 reviews（而非 skills.status） |
| `team/member/MySubmissions/index.tsx` | **承担"编辑+提交"**：新增 DRAFT tab；对 DRAFT/REJECTED/CHANGES_REQUESTED/WITHDRAWN 支持原地编辑（PATCH）+ submit/resubmit |
| `pages/create/` 创建表单 | URL/接口不变；"保存草稿"对应 `draft=true`，落 reviews.DRAFT |
| 编辑入口 | MySubmissions 进入"编辑提交"页（按 reviewId 编辑 review payload）；`/skills/:slug` 编辑页仅服务已 APPROVED 的元数据维护 |
| `team/admin/_shared/api.ts` | review 列表/详情类型加 cat/icon/langs/tags 等新字段 |

### 7.2 "我的草稿" 入口

- 旧的"团队 Skill 库 → 草稿 tab"删除。
- 草稿统一在 `MySubmissions` 的 DRAFT tab，路由 `/u/me/submissions?status=DRAFT`。

### 7.3 SkillDetail 公共/团队详情页

- 不再展示 `PENDING_REVIEW / REJECTED / CHANGES_REQUESTED` 状态的 skill（因为它们根本不在 skills 表）。
- `SkillService.getDetail` 中"非 APPROVED/UNLISTED 状态的可见性兜底"成为历史兜底（保留以应对未迁移数据）。

## 8. 数据迁移（V15）

```sql
-- 1) reviews 扩列
ALTER TABLE reviews
  ADD COLUMN cat_code   VARCHAR(64)   NULL AFTER short_desc,
  ADD COLUMN icon       VARCHAR(64)   NULL AFTER cat_code,
  ADD COLUMN langs_json VARCHAR(256)  NULL AFTER icon,
  ADD COLUMN tags_json  VARCHAR(1024) NULL AFTER langs_json,
  ADD COLUMN kind       VARCHAR(16)   NOT NULL DEFAULT 'CREATE' AFTER tags_json;

-- 2) 回填 kind
UPDATE reviews r
JOIN skills s ON s.id = r.skill_id
SET r.kind = CASE
  WHEN s.status IN ('APPROVED','UNLISTED') AND r.version <> s.version THEN 'VERSION_BUMP'
  ELSE 'CREATE'
END;

-- 3) 把 skills 中 DRAFT/PENDING_REVIEW/REJECTED/CHANGES_REQUESTED 的行"下嫁"到 reviews
--    a) 已存在 open review：把 cat_code/icon/langs/tags_json 复制过去
UPDATE reviews r
JOIN skills s ON s.id = r.skill_id
LEFT JOIN (
  SELECT st.skill_id, JSON_ARRAYAGG(t.name) AS tags
  FROM skill_tag st JOIN tags t ON t.id = st.tag_id
  GROUP BY st.skill_id
) tg ON tg.skill_id = s.id
SET r.cat_code = s.cat_code,
    r.icon = s.icon,
    r.langs_json = s.langs,
    r.tags_json = COALESCE(tg.tags, JSON_ARRAY())
WHERE s.status IN ('DRAFT','PENDING_REVIEW','REJECTED','CHANGES_REQUESTED')
  AND r.kind='CREATE';

--    b) skills.DRAFT 但没有 review 行：为每个新建一条 reviews.kind='CREATE'
INSERT INTO reviews (code, skill_id, skill_slug, skill_name, short_desc,
                     team_id, submitter_id, visibility, files_count, version,
                     safety, eval_score, status, submitted_at,
                     cat_code, icon, langs_json, tags_json, kind, created_at, updated_at)
SELECT CONCAT('r-mig-', s.id),
       NULL, s.slug, s.name, s.short_desc,
       s.team_id, s.author_id, s.visibility, 0, s.version,
       s.safety, s.eval_score, 'DRAFT', NOW(),
       s.cat_code, s.icon, s.langs,
       COALESCE((SELECT JSON_ARRAYAGG(t.name)
                 FROM skill_tag st JOIN tags t ON t.id=st.tag_id
                 WHERE st.skill_id = s.id), JSON_ARRAY()),
       'CREATE', NOW(), NOW()
FROM skills s
WHERE s.status='DRAFT'
  AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.skill_id = s.id);

-- 4) 清理 skill_tag：被下嫁的 skills 行的 tag 关联失效（tags_json 已快照）
DELETE st FROM skill_tag st
JOIN skills s ON s.id = st.skill_id
WHERE s.status IN ('DRAFT','PENDING_REVIEW','REJECTED','CHANGES_REQUESTED');

-- 5) 把被下嫁的 reviews 行的 skill_id 置空（kind='CREATE' 的）
UPDATE reviews r
JOIN skills s ON s.id = r.skill_id
SET r.skill_id = NULL
WHERE s.status IN ('DRAFT','PENDING_REVIEW','REJECTED','CHANGES_REQUESTED')
  AND r.kind='CREATE';

-- 6) 软删被下嫁的 skills 行
UPDATE skills SET deleted = 1
WHERE status IN ('DRAFT','PENDING_REVIEW','REJECTED','CHANGES_REQUESTED');
```

### 8.1 迁移幂等性 / 安全

- 整段在 Flyway 单 migration，失败一次性回滚。
- 删除 skills 行（步骤 6）放最后，前置步骤失败可重跑。
- 跑前在本地 / staging 验证迁移前后行数对账。

### 8.2 回滚策略

- Schema 是向前兼容的（reviews 新增列允许 NULL）。
- Service 层加 feature flag `skillstack.review.review-first-submit=true|false`：
  - flag=true（默认）：走新路径。
  - flag=false：`SkillService.create` 回退老路径（直接写 skills.PENDING_REVIEW + reviews 镜像）。
  - 适用于上线后紧急回退；但迁移后历史数据已经搬到 reviews，回退后老路径产生的新数据与历史不冲突。

## 9. 测试基线

### 9.1 后端

- 单测：
  - `SkillServiceTest`：create 在 REVIEW 模式下不写 skills；DIRECT_PUBLISH 仍写 skills。
  - `ReviewServiceTest`：approve(CREATE) 物化 skill + skill_versions + skill_tag；slug 冲突回滚；reject/request-changes/withdraw 对 kind='CREATE' 不动 skills；对 kind='VERSION_BUMP' 不退 skills.status。
- 集成：
  - `mvn test` 全套绿。
  - `mvn -q -DskipTests compile` 通过。

### 9.2 前端

- `npm run lint`（tsc -b）
- `npm run build`
- 浏览器 smoke：
  1. 创建表单 → 保存草稿 → 在 MySubmissions/DRAFT 中可见；
  2. 编辑草稿 → 提交 → 进入 PENDING_REVIEW；
  3. 管理员 reject → 在 MySubmissions/REJECTED 中可见 + 可编辑；
  4. 编辑后 resubmit → 回到 PENDING_REVIEW；
  5. 管理员 approve → Skill 出现在团队 Skill 库（APPROVED）；
  6. 团队 Skill 库 admin 视角不再看到任何 PENDING/REJECTED/DRAFT；
  7. 版本提交（已 APPROVED 的 skill） → reject → 上线版本仍 APPROVED。

## 10. 风险与已知限制

- DIRECT_PUBLISH + draft=true 仍走 reviews.DRAFT 路径（保持作者保存草稿的一致体验）。
- 旧 URL `/skills/:slug` 对未物化 skill 不可访问 — 这是预期，外部分享一个 pending skill 无意义；MySubmissions 是唯一编辑入口。
- 并发：approve 与作者 PATCH 之间用 `@Transactional` + review.status 状态校验防御，不引入分布式锁。
- migration 第 3a 步用 `JSON_ARRAYAGG`，要求 MySQL ≥ 5.7.22（线上 MySQL 8 满足）。

## 11. 相关文件

后端：

- `backend/src/main/resources/db/migration/V15__review_first_submission.sql`（新增）
- `backend/src/main/java/com/skillstack/skill/service/SkillService.java`（create 分流）
- `backend/src/main/java/com/skillstack/skill/dto/CreateSkillRes.java`（加 reviewId）
- `backend/src/main/java/com/skillstack/review/entity/Review.java`（加 catCode/icon/langsJson/tagsJson/kind）
- `backend/src/main/java/com/skillstack/review/service/ReviewService.java`（approve 物化、reject/withdraw/requestChanges 不再回写 skills）
- `backend/src/main/java/com/skillstack/review/controller/ReviewController.java`（PATCH/submit/delete 端点）
- `backend/src/main/java/com/skillstack/review/dto/*`（payload edit DTO）

前端：

- `frontend/src/pages/team/admin/Skills.tsx`（删 tab）
- `frontend/src/pages/team/member/MySubmissions/index.tsx`（DRAFT tab + 编辑 + resubmit）
- `frontend/src/pages/team/member/Dashboard.tsx`（计数源切换）
- `frontend/src/api/`（review endpoints 扩展）
- `frontend/src/pages/team/admin/_shared/api.ts`（review 类型加新字段）
