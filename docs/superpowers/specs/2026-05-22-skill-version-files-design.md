# Skill 版本文件清单（仅列表）

- 日期: 2026-05-22
- 范围: 公共 / 团队 Skill 详情页「文件」tab
- 状态: Draft

## 背景

Skill 详情页（`frontend/src/pages/public/SkillDetail.tsx` + `Detail/Main.tsx`）已经存在「文件」tab，但实现只是一个占位卡片，写死「当前可通过下方安装方式拉取源码或下载 Zip 包浏览」。

后端目前没有「列出某个版本 zip 内文件」的接口，前端也没有渲染文件清单的组件。

但实际数据是齐的：

- 所有上传链路（zip 上传 / 单 md 上传 / 粘贴 md 文本）最终都会通过 `StorageService` 落地为一个真实 zip，key 写入 `skill_version.zip_url`。
- `StorageService.openStream(key)` 已经支持读取该 zip。
- `SkillParseService` 已经能流式扫描 zip 条目，但扫描结果只用于做提交时校验，没有持久化。

## 目标

「文件」tab 显示该版本 zip 内真实文件的树状清单，包含路径与大小。覆盖：

- 新提交的 skill / 新版本（实时建索引）
- 历史已发布版本（首次访问时懒回填）

不做：

- 文件内容预览
- 单文件下载
- 文件搜索 / 筛选

## 非目标

- 不重写下载链路（`SkillDownloadService` 当前的合成 zip 行为不在本次范围内）
- 不接对象存储 CDN
- 不暴露绝对路径或 storage key

## 数据模型

新增表 `skill_version_file`：

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | BIGINT, PK, AUTO_INCREMENT | |
| `version_id` | BIGINT, NOT NULL, INDEX | 对应 `skill_version.id` |
| `path` | VARCHAR(512), NOT NULL | zip 内的相对路径，保留顶层目录（如 `my-skill-1.0.0/SKILL.md`） |
| `size` | BIGINT, NOT NULL, DEFAULT 0 | 文件字节数 |
| `sort` | INT, NOT NULL, DEFAULT 0 | 写入顺序，列表按它升序返回 |
| `created_at` | DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

约束：

- `INDEX idx_skill_version_file_version (version_id, sort)`
- 不存目录条目（zip 中 `name` 以 `/` 结尾的 entry）
- 跳过常见噪声前缀：`__MACOSX/`、`.DS_Store`、以 `.` 开头的隐藏文件保留（这些是 skill 内容的一部分）
- 跳过路径含 `..` 的恶意 entry（与 `SkillParseService` 现有行为一致）

新增 Flyway migration：在 `backend/src/main/resources/db/migration/` 下按递增编号追加（写入时确认下一个可用编号）。

## 后端

### 新 Service：`SkillVersionFileService`

位置：`backend/src/main/java/com/skillstack/skill/service/SkillVersionFileService.java`

职责：

- `materialize(Long versionId, String zipKey)`
  - 事务方法
  - 从 `storage.openStream(zipKey)` 用 `ZipInputStream` 扫描 entry
  - 先 `delete where version_id = ?` 再批量 insert，保证幂等
  - 跳过目录条目、噪声路径、`..` 条目
  - `size` 取自 `ZipEntry.getSize()`；为 `-1` 时回退为流式累计
  - `sort` 为遇到顺序的递增整数
  - 上限：复用 `SkillParseService.MAX_ENTRIES`，超出截断并记录 warn 日志
- `list(Long versionId)`
  - 按 `sort ASC` 查询返回 entity 列表
- `listWithLazyBackfill(SkillVersion version)`
  - 若该 version 已有行，直接返回
  - 否则若 `version.zipUrl` 非空且 `storage.exists(zipUrl)`，调用 `materialize` 后再查
  - 否则返回空列表

新 Mapper：`SkillVersionFileMapper`（MyBatis Plus `BaseMapper<SkillVersionFile>` + 自定义 `deleteByVersionId(Long)`）。

新 Entity：`SkillVersionFile`（与表字段一一对应，逻辑删除字段一律不加，文件清单跟随版本生死）。

### 接入现有写路径

- `SkillService.createSkill(...)`：创建 skill 行 + 初始版本之后，拿到 `versionId` 和 `zipUrl`，调用 `fileService.materialize`
- `SkillService.submitVersion(...)`：新版本插入之后，同样调用 `fileService.materialize`
- materialize 失败不应阻塞主流程：捕获异常记录 warn 日志，让用户的提交照常成功，下次访问会经 lazy backfill 重试

### 新 Controller endpoint

在 `SkillController` 中追加：

```
GET /api/skills/{slug}/versions/{version}/files
```

- 入参：`slug`（path），`version`（path，必填）
- 权限：调用 `skillService.requireReadable(slug, currentUserId)`，与 `/download` 完全一致
- 找到 `SkillVersion`：与 `SkillDownloadService` 一致的解析逻辑（指定版本找不到时回退到 skill 当前版本）
- 调用 `fileService.listWithLazyBackfill(version)`
- 返回：

```json
{
  "code": 0,
  "data": [
    { "path": "my-skill-1.0.0/SKILL.md", "size": 1234 },
    { "path": "my-skill-1.0.0/scripts/hello.py", "size": 256 }
  ]
}
```

### Security

- `SecurityConfig`：在已有 `/api/skills/*/download` 的 permitAll 旁追加 `/api/skills/*/versions/*/files`
- `JwtAuthFilter.isPublic`：同步增加对该 pattern 的匿名放行（与现有公共 skill detail / download 一致）
- 鉴权依然落在 `requireReadable`，公开 + 已审核才返回数据，私有 / pending / rejected 给 401/403

## 前端

### API client

`frontend/src/api/skills.ts` 新增：

```ts
export async function getSkillVersionFiles(slug: string, version: string): Promise<SkillFileEntry[]>;

export interface SkillFileEntry {
  path: string;
  size: number;
}
```

### 文件树工具

新文件 `frontend/src/pages/public/Detail/fileTree.ts`：

- 输入：`SkillFileEntry[]`
- 输出：

```ts
export interface FileTreeNode {
  name: string;            // 该层显示的名字
  path: string;            // 完整路径（叶子），目录节点为该目录的完整前缀
  isDir: boolean;
  size: number;            // 叶子: 文件字节; 目录: 子树总和
  children: FileTreeNode[];
}
```

- 把扁平 paths 按 `/` 拆分组装成嵌套树
- 目录节点按 `name` 升序，文件节点按 `name` 升序，目录排在文件前
- 不做路径前缀剥离（保留顶层 `slug-version/`）

### 详情页

`frontend/src/pages/public/Detail/Main.tsx`：

- 替换 `tab === 'files'` 分支
- 新组件 `FilesPanel`（同目录 `FilesPanel.tsx`）：
  - Props: `slug`, `version`
  - 内部用 `useQuery` 拉数据，`enabled: tab === 'files'`
  - 渲染树形列表：
    - 行内容：`├─ icon  name`（图标用 `I.code` 表示文件，自定义 folder 图标用 `lucide-react` 的 `Folder` / `FolderOpen`，与 `frontend/src/components/icons.tsx` 风格保持一致）
    - 行右侧灰色显示文件大小（`formatBytes` 工具）
    - 目录默认全部展开（结构通常很浅，体验更直观；以后再加折叠状态）
    - 缩进每层 16px
  - 三态显式：
    - loading：渲染占位骨架
    - error：渲染居中错误提示 + 重试按钮
    - empty：渲染「该版本暂无文件」灰字
  - 顶部一行 meta：`共 N 个文件 · 总大小 X`
- `filesCount` 字段沿用现有展示，不与文件清单接口耦合

### Sidebar / 计数

侧边栏 `Sidebar.tsx` 已用 `skill.filesCount`，不改。但要保证后端 `skill_version.files_count` 与文件清单条数一致：

- 写路径已存在 `files_count` 字段且已正确写入，不变
- 历史数据 `files_count` 不准的情况不在本次范围内（如确实出现，靠 lazy backfill 时同步刷新 `files_count` 可作为后续优化）

## 验证

后端：

- `cd backend && mvn -q -DskipTests compile`
- `cd backend && mvn test`
- 手工：
  - 上传单 md skill → 进入详情 → files tab 能看到 `SKILL.md`
  - 上传多文件 zip skill → files tab 显示完整树
  - 历史版本（migration 之前已存在）→ 首次访问 files tab 触发 lazy backfill，第二次访问无再 backfill
  - 非可见 skill 用未登录 / 非成员访问 → 403/401

前端：

- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- 浏览器 smoke：
  - 单 md / 多文件 zip 两种 skill 的 files tab
  - 切换版本（`SkillVersion` 切换时 files 应该跟随 refetch）
  - 加载、空、错误三态

## 风险与回滚

- materialize 在写路径同步执行：单包 ≤ 20MB、entry ≤ MAX_ENTRIES，扫描成本可控；失败已被 catch 不阻塞主流程
- 老版本 zip 在存储里缺失：lazy backfill 会查 `storage.exists`，缺失则返回空列表，不抛错
- 回滚方式：删 endpoint + 前端面板回滚为占位即可；表保留无害

## 不做（YAGNI）

- 文件内容预览（B 范围）
- 单文件下载（C 范围）
- Materialize 异步任务化
- 文件搜索 / 筛选 / 排序切换
- `files_count` 自动校正
