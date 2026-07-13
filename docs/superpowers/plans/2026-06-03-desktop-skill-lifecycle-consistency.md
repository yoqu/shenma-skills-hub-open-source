# 桌面端 Skill 生命周期一致性实施计划

> **给执行 Agent 的要求：** 实施本文档时必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行。所有步骤使用 checkbox（`- [ ]`）跟踪进度。

**目标：** 统一桌面端 Skill 在服务数据库、本地 SQLite、`~/.skillstack/skills/<slug>` 缓存目录、Claude/Codex 生效目录之间的状态语义，解决“禁用后又变启用”“广场已添加却显示可安装”等状态错乱问题。

**架构思路：** 不再用一个 `Boolean(view.local)` 代表所有状态，而是把四层状态拆开：服务数据库记录表示“已添加”，SQLite enabled 字段表示“是否启用”，`~/.skillstack/skills/<slug>` 表示“本地缓存是否存在”，Claude/Codex 的 `skills` 目录表示“是否对 Agent 生效”。新增明确的启用/禁用 API，禁止禁用流程复用删除/卸载流程。

**技术栈：** Electron main/preload、React + TypeScript、SQLite、Vitest、TanStack Query。

---

## 一、已确认的生命周期语义

### 1. 安装

安装必须完成四层写入：

1. 写服务数据库，例如 `user_skills`。
2. 写本地 SQLite。
3. 写缓存目录：`~/.skillstack/skills/<slug>`。
4. 按当前设置同步到 Claude/Codex 的 `skills` 目录，方式为软链接或复制副本。

如果服务数据库记录已创建，但本地安装失败，必须回滚：

1. 删除服务数据库记录。
2. 删除本地 SQLite 记录。
3. 清理本次安装产生的缓存目录残留。
4. 清理 Claude/Codex 目录下本次安装产生的软链接或复制副本。

### 2. 禁用

禁用不是删除。

禁用必须做到：

1. 保留服务数据库记录。
2. 保留本地 SQLite 记录。
3. 修改 SQLite enabled 字段为禁用。
4. 保留 `~/.skillstack/skills/<slug>` 缓存目录。
5. 只删除 Claude/Codex 的 `skills` 目录中的软链接或复制副本。

禁用后 UI 语义：

1. 广场卡片仍然显示 `√`，因为服务数据库仍有记录。
2. 详情不能显示“可安装”。
3. 如果本地缓存存在但未启用，显示“已添加”或“已禁用”，不能显示“已安装”。

### 3. 启用

启用必须做到：

1. 保留服务数据库记录。
2. 保留本地 SQLite 记录。
3. 修改 SQLite enabled 字段为启用。
4. 如果 `~/.skillstack/skills/<slug>` 缓存目录存在，直接从缓存目录同步到 Claude/Codex。
5. 如果缓存目录不存在，才走完整下载/安装流程。

### 4. 更新

更新必须做到：

1. 广场/团队 Skill 从服务端 `Skills` 表或版本表取最新信息。
2. 更新服务数据库中的用户技能版本等信息。
3. 更新本地 SQLite。
4. 更新 `~/.skillstack/skills/<slug>` 缓存目录。
5. 如果当前 SQLite enabled 字段为启用，则同步到 Claude/Codex。
6. 如果当前 SQLite enabled 字段为禁用，只更新缓存，不创建 Agent 目录链接或副本。

### 5. 删除

删除必须完成四层清理：

1. 删除服务数据库记录。
2. 删除本地 SQLite 记录。
3. 删除 `~/.skillstack/skills/<slug>` 缓存目录。
4. 删除 Claude/Codex 的 `skills` 目录中的软链接或复制副本。

### 6. 设置页切换“软链接/复制”

切换同步方式不是安装、不是禁用、不是删除。

切换同步方式必须做到：

1. 不修改服务数据库。
2. 不修改本地 SQLite enabled 状态。
3. 不修改 `~/.skillstack/skills/<slug>` 缓存目录内容。
4. 只针对当前 enabled 的 Skill，重建 Claude/Codex 目录里的软链接或复制副本。
5. disabled 的 Skill 不能因为切换同步方式而重新出现在 Claude/Codex 目录。

## 二、当前问题根因

当前问题不是单个按钮显示错，而是状态模型混用了。

已定位到的风险点：

1. `desktop/electron/skillStore.ts` 的 SQLite 表已有 `enabled_claude`、`enabled_codex`，但 `recordToInstallEntry()` 没有把这两个字段传给前端。
2. `desktop/src/pages/types.ts` 的 `LocalInstallEntry` 没有 `enabledClaude`、`enabledCodex`。
3. `desktop/src/pages/status.ts` 只要存在 local entry，就当成“已安装/已启用”。
4. `desktop/src/pages/MySkillsPage.tsx` 用 `Boolean(view.local)` 判断开关状态。
5. `desktop/src/pages/MySkillsPage.tsx` 的详情弹窗也用 `Boolean(selectedView?.local)` 判断 `installed`。
6. `desktop/src/pages/desktopBridge.ts` 的 `uninstallDesktopSkill()` 调 Electron `uninstallSkill()` 后又调 `removeLocalInstall()`，这是删除语义，不适合禁用。
7. `desktop/electron/main.cts` 的 `uninstallSkill(slug)` 会删除缓存目录并删除 SQLite，这是删除/卸载语义，不适合禁用。
8. `desktop/electron/skillStore.ts` 的 `removeExistingSyncPath()` 对 copy 模式不可靠，因为复制目录的 realpath 不会等于缓存目录 realpath，可能导致复制副本没有被删除。

## 三、统一状态模型

后续所有页面和逻辑按这四层判断：

| 状态来源 | 含义 |
| --- | --- |
| 服务数据库记录 | 已添加 |
| 本地 SQLite 记录 | 本地已纳入管理 |
| SQLite `enabled_claude/enabled_codex` | 是否启用到对应 Agent |
| `~/.skillstack/skills/<slug>` | 本地缓存是否存在 |
| Claude/Codex `skills/<slug>` | Agent 当前是否实际可用 |

前端建议增加明确 helper：

```ts
function isLocalEnabled(local: LocalInstallEntry | null | undefined): boolean {
  return Boolean(local?.enabledClaude || local?.enabledCodex);
}

function hasLocalCache(local: LocalInstallEntry | null | undefined): boolean {
  return Boolean(local?.installPath);
}

function isAdded(view: DesktopSkillView): boolean {
  return Boolean(view.cloud);
}
```

禁止继续用：

```ts
Boolean(view.local)
```

来表示“已启用”。

## 四、文件职责和改动范围

### `desktop/electron/skillStore.ts`

职责：本地 SQLite、缓存目录、Agent 目录同步的源头。

需要改动：

1. `LocalInstallEntry` 增加 `enabledClaude`、`enabledCodex`。
2. `recordToInstallEntry()` 返回 enabled 字段。
3. 新增 `setLocalSkillEnabled()`，只修改 enabled 字段并同步/移除 Agent 目录，不删除缓存、不删除 SQLite。
4. 新增 `resyncEnabledSkillRecords()`，用于切换软链接/复制方式后重建 Agent 目录。
5. 修复 copy 模式下复制副本不能被移除的问题。
6. 保持 `removeLocalSkillRecord()` 为删除语义。

### `desktop/electron/main.cts`

职责：Electron IPC 和安装/卸载流程。

需要改动：

1. 新增 `skillstack:local-installs:set-enabled` IPC。
2. `saveConfig` 后触发 enabled Skill 的 Agent 目录重建。
3. `uninstallSkill()` 继续作为删除缓存 + 删除 SQLite 的完整删除语义。
4. 增加 `LOCAL_SKILL_NOT_FOUND`、`LOCAL_SKILL_CACHE_MISSING` 错误映射。

### `desktop/electron/preload.cts`

职责：暴露 Electron API 给 renderer。

需要改动：

1. local install 类型增加 enabled 字段。
2. 暴露 `setLocalSkillEnabled()`。

### `desktop/src/skillstack-desktop.d.ts`

职责：全局 `window.skillstackDesktop` 类型。

需要改动：

1. local install 类型增加 enabled 字段。
2. API 类型增加 `setLocalSkillEnabled()`。

### `desktop/src/pages/types.ts`

职责：renderer 页面状态类型。

需要改动：

1. `LocalInstallEntry` 增加 `enabledClaude`、`enabledCodex`。
2. `DesktopSkillStatus` 增加 disabled/added-but-not-enabled 状态，例如 `INSTALLED_DISABLED`。

### `desktop/src/pages/status.ts`

职责：把云端记录和本地记录合并为页面视图。

需要改动：

1. 根据 `view.cloud` 判断“已添加”。
2. 根据 `enabledClaude/enabledCodex` 判断“已启用/已安装”。
3. disabled 状态不能落入 `NOT_INSTALLED`。
4. disabled 状态不能落入 `INSTALLED_LATEST`。

### `desktop/src/pages/desktopBridge.ts`

职责：renderer 对 Electron API 的封装。

需要改动：

1. 新增 `setDesktopSkillEnabled()`。
2. 禁用流程调用 set-enabled，不调用 uninstall。
3. 安装失败回滚和删除流程仍可使用完整删除 API。

### `desktop/src/pages/localInstallStore.ts`

职责：无 Electron API 时的 fallback localStorage。

需要改动：

1. fallback local install 增加 enabled 字段。
2. 新增 fallback 的 set-enabled 行为。

### `desktop/src/pages/MySkillsPage.tsx`

职责：我的 Skills 页面交互。

需要改动：

1. Toggle checked 使用 `isLocalEnabled(view.local)`。
2. 禁用调用 `setDesktopSkillEnabled(slug, id, false)`。
3. 启用优先调用 `setDesktopSkillEnabled(slug, id, true)`。
4. 如果启用时缓存缺失，再走完整安装。
5. 删除仍走完整删除。
6. 详情弹窗 `installed` 不能再用 `Boolean(view.local)`。

### `desktop/src/pages/mySkillsGroups.ts`

职责：团队 Skill 添加并安装，以及失败回滚。

需要确认：

1. 安装失败时回滚服务数据库。
2. 安装失败时清理本地 SQLite、缓存目录、Agent 目录。
3. 这里使用完整删除语义，不使用禁用语义。

## 五、实施任务

### 任务 1：把 SQLite enabled 状态传到前端

**文件：**

- 修改：`desktop/electron/skillStore.ts`
- 修改：`desktop/electron/preload.cts`
- 修改：`desktop/src/skillstack-desktop.d.ts`
- 修改：`desktop/src/pages/types.ts`
- 测试：`desktop/electron/skillStore.test.ts`

- [ ] **步骤 1：先写失败测试**

在 `desktop/electron/skillStore.test.ts` 增加用例：保存一个同时启用 Claude/Codex 的本地 Skill，调用 `listLocalInstalls()` 后断言返回值包含：

```ts
expect(entry).toMatchObject({
  slug: 'enabled-state-skill',
  enabledClaude: true,
  enabledCodex: true,
});
```

- [ ] **步骤 2：运行测试确认失败**

```bash
cd desktop && npm test -- skillStore.test.ts --run
```

预期：失败，因为当前返回值没有 enabled 字段。

- [ ] **步骤 3：补齐类型和 mapper**

`desktop/electron/skillStore.ts` 的 `LocalInstallEntry` 增加：

```ts
enabledClaude: boolean;
enabledCodex: boolean;
```

`recordToInstallEntry()` 增加：

```ts
enabledClaude: record.enabledClaude,
enabledCodex: record.enabledCodex,
```

preload、global d.ts、renderer `LocalInstallEntry` 同步增加相同字段。

- [ ] **步骤 4：运行测试确认通过**

```bash
cd desktop && npm test -- skillStore.test.ts --run
```

预期：通过。

### 任务 2：新增禁用/启用 API，不删除缓存

**文件：**

- 修改：`desktop/electron/skillStore.ts`
- 修改：`desktop/electron/main.cts`
- 修改：`desktop/electron/preload.cts`
- 修改：`desktop/src/skillstack-desktop.d.ts`
- 测试：`desktop/electron/skillStore.test.ts`

- [ ] **步骤 1：写禁用测试**

新增测试场景：

1. 创建缓存目录 `~/.skillstack/skills/disable-keeps-cache`。
2. upsert SQLite 记录。
3. 确认 Claude/Codex 目录下已有链接或副本。
4. 调用 `setLocalSkillEnabled({ slug, enabled: false })`。
5. 断言 SQLite 记录仍存在。
6. 断言 enabled 字段为 false。
7. 断言缓存目录仍存在。
8. 断言 Claude/Codex 目录下对应 slug 已被移除。

- [ ] **步骤 2：写启用测试**

新增测试场景：

1. 先安装并禁用。
2. 确认缓存目录仍存在。
3. 调用 `setLocalSkillEnabled({ slug, enabled: true })`。
4. 断言 enabled 字段为 true。
5. 断言 Claude/Codex 目录下重新出现链接或副本。

- [ ] **步骤 3：运行测试确认失败**

```bash
cd desktop && npm test -- skillStore.test.ts --run
```

预期：失败，因为 `setLocalSkillEnabled()` 尚不存在。

- [ ] **步骤 4：实现 `setLocalSkillEnabled()`**

核心语义：

```ts
export async function setLocalSkillEnabled(input: unknown): Promise<LocalInstallEntry> {
  const existing = await findLocalSkillRecord(userSkillId, slug);
  if (!existing) {
    throw new Error('LOCAL_SKILL_NOT_FOUND');
  }

  const settings = await readSkillStoreSettings();
  const next = {
    ...existing,
    enabledClaude: enabled && settings.agents.includes('CLAUDE'),
    enabledCodex: enabled && settings.agents.includes('CODEX'),
    updatedAt: new Date().toISOString(),
  };

  await updateEnabledFieldsInSqlite(next);
  await removeSkillLinks(existing, settings);

  if (enabled) {
    await assertSkillCacheExists(next.installPath);
    await syncSkillRecord(next, settings);
  }

  return recordToInstallEntry(next);
}
```

注意：

1. 禁用时不能删除 SQLite。
2. 禁用时不能删除 `~/.skillstack/skills/<slug>`。
3. 禁用时必须删除 Claude/Codex 的链接或副本。
4. 启用时缓存不存在要返回 `LOCAL_SKILL_CACHE_MISSING`，由 renderer 决定是否走完整安装。

- [ ] **步骤 5：接入 IPC**

`desktop/electron/main.cts` 增加：

```ts
ipcMain.handle('skillstack:local-installs:set-enabled', (_event, input: unknown) =>
  handleDesktopOperation(() => setLocalSkillEnabled(input)),
);
```

`desktop/electron/preload.cts` 暴露：

```ts
setLocalSkillEnabled: (input) =>
  ipcRenderer.invoke('skillstack:local-installs:set-enabled', input),
```

`desktop/src/skillstack-desktop.d.ts` 增加对应类型。

- [ ] **步骤 6：运行测试确认通过**

```bash
cd desktop && npm test -- skillStore.test.ts --run
```

预期：通过。

### 任务 3：修复 copy 模式副本删除

**文件：**

- 修改：`desktop/electron/skillStore.ts`
- 测试：`desktop/electron/skillStore.test.ts`

- [ ] **步骤 1：写 copy 模式禁用测试**

新增测试场景：

1. 设置 `skillSyncMethod: 'copy'`。
2. 安装 Skill。
3. 确认 Claude/Codex 目录下是复制目录，不是 symlink。
4. 禁用 Skill。
5. 断言复制目录已被删除。
6. 断言缓存目录仍存在。

- [ ] **步骤 2：运行测试确认失败**

```bash
cd desktop && npm test -- skillStore.test.ts --run
```

预期：如果当前 copy 副本没有被删除，测试失败。

- [ ] **步骤 3：修复删除逻辑**

建议逻辑：

1. symlink：直接删除。
2. directory：如果目录包含 `SKILL.md`，且调用方传入路径来自配置的 Claude/Codex skills 目录，则允许删除。

示例：

```ts
async function removeExistingSyncPath(targetPath: string, expectedRealPath: string): Promise<void> {
  const stat = await lstatIfExists(targetPath);
  if (!stat) return;

  if (stat.isSymbolicLink()) {
    await fs.rm(targetPath, { force: true });
    return;
  }

  if (stat.isDirectory()) {
    const targetRealPath = await fs.realpath(targetPath).catch(() => '');
    const expected = await fs.realpath(expectedRealPath).catch(() => expectedRealPath);
    if (targetRealPath === expected || await hasSkillMarker(targetPath)) {
      await fs.rm(targetPath, { recursive: true, force: true });
    }
  }
}
```

**待确认风险：** 如果用户手动在 Claude/Codex skills 目录创建了同 slug 且包含 `SKILL.md` 的目录，这个逻辑可能会删除手工目录。更稳妥的方案是在复制副本中写 `.skillstack-sync.json` 标记，只删除带标记的副本，但这需要兼容历史 copy 副本。

- [ ] **步骤 4：运行测试确认通过**

```bash
cd desktop && npm test -- skillStore.test.ts --run
```

预期：通过。

### 任务 4：切换软链接/复制方式时只重建 Agent 目录

**文件：**

- 修改：`desktop/electron/skillStore.ts`
- 修改：`desktop/electron/main.cts`
- 测试：`desktop/electron/skillStore.test.ts`

- [ ] **步骤 1：写同步方式切换测试**

新增测试场景：

1. 设置为 symlink。
2. 安装并启用 Skill。
3. 记录缓存目录 mtime。
4. 切换为 copy。
5. 调用 `resyncEnabledSkillRecords()`。
6. 断言 Agent 目录从 symlink 变成 copy。
7. 断言缓存目录 mtime 不变。

- [ ] **步骤 2：写 disabled 不重建测试**

新增测试场景：

1. 安装 Skill。
2. 禁用 Skill。
3. 切换同步方式。
4. 调用 resync。
5. 断言缓存目录仍存在。
6. 断言 Claude/Codex 目录没有重新出现该 Skill。

- [ ] **步骤 3：实现 `resyncEnabledSkillRecords()`**

核心逻辑：

```ts
export async function resyncEnabledSkillRecords(): Promise<{ synced: number }> {
  const settings = await readSkillStoreSettings();
  const records = await listLocalSkillRecords();
  let synced = 0;

  for (const record of records) {
    await removeSkillLinks(record, settings);

    if (!record.enabledClaude && !record.enabledCodex) {
      continue;
    }

    await assertSkillCacheExists(record.installPath);
    await syncSkillRecord(record, settings);
    synced += 1;
  }

  return { synced };
}
```

- [ ] **步骤 4：设置保存后触发 resync**

`desktop/electron/main.cts` 中保存配置后调用：

```ts
const settings = await saveSkillStoreSettings(input);
await resyncEnabledSkillRecords();
return settings;
```

- [ ] **步骤 5：运行测试确认通过**

```bash
cd desktop && npm test -- skillStore.test.ts --run
```

预期：通过。

### 任务 5：状态合并逻辑区分“已添加”和“已启用”

**文件：**

- 修改：`desktop/src/pages/types.ts`
- 修改：`desktop/src/pages/status.ts`
- 测试：`desktop/src/pages/status.test.ts`

- [ ] **步骤 1：写 disabled 状态测试**

新增测试场景：

1. 云端存在广场记录。
2. 本地 SQLite 记录存在。
3. `enabledClaude=false` 且 `enabledCodex=false`。
4. 断言状态不是 `NOT_INSTALLED`。
5. 断言状态不是 `INSTALLED_LATEST`。
6. 断言状态为“已添加/未启用”。

建议断言：

```ts
expect(view.status).toBe('INSTALLED_DISABLED');
expect(view.statusLabel).toBe('已添加');
expect(view.description).toBe('已添加 · 未启用');
expect(view.actions).toEqual(['view', 'install', 'delete']);
```

- [ ] **步骤 2：运行测试确认失败**

```bash
cd desktop && npm test -- status.test.ts --run
```

预期：失败。

- [ ] **步骤 3：增加状态类型**

`DesktopSkillStatus` 增加：

```ts
| 'INSTALLED_DISABLED'
```

- [ ] **步骤 4：更新状态判断**

在 `status.ts` 增加：

```ts
function isLocalEnabled(local: LocalInstallEntry | null | undefined): boolean {
  return Boolean(local?.enabledClaude || local?.enabledCodex);
}
```

版本比较前先判断 disabled：

```ts
if (local && !isLocalEnabled(local)) {
  views.push({
    cloud,
    local,
    status: 'INSTALLED_DISABLED',
    statusLabel: '已添加',
    description: '已添加 · 未启用',
    actions: ['view', 'install', 'delete'],
  });
  continue;
}
```

- [ ] **步骤 5：运行测试确认通过**

```bash
cd desktop && npm test -- status.test.ts --run
```

预期：通过。

### 任务 6：renderer bridge 增加启用/禁用封装

**文件：**

- 修改：`desktop/src/pages/desktopBridge.ts`
- 修改：`desktop/src/pages/localInstallStore.ts`
- 测试：`desktop/src/pages/desktopBridge.test.ts`

- [ ] **步骤 1：写 bridge 测试**

新增测试：

1. 调用 `setDesktopSkillEnabled(slug, id, false)`。
2. 断言调用 Electron `setLocalSkillEnabled`。
3. 断言没有调用 `uninstallSkill`。

核心断言：

```ts
expect(setLocalSkillEnabled).toHaveBeenCalledWith({
  slug: 'cloud-skill',
  userSkillId: 1,
  enabled: false,
});
expect(uninstallSkill).not.toHaveBeenCalled();
```

- [ ] **步骤 2：实现 bridge 方法**

`desktopBridge.ts` 增加：

```ts
export async function setDesktopSkillEnabled(slug: string, userSkillId: number | undefined, enabled: boolean): Promise<void> {
  const api = getDesktopApi();
  if (api?.setLocalSkillEnabled) {
    const result = await api.setLocalSkillEnabled({ userSkillId, slug, enabled });
    if (!result.ok) throw new Error(result.error.message);
    return;
  }

  setFallbackLocalEnabled(userSkillId, slug, enabled);
}
```

`localInstallStore.ts` 增加 fallback：

```ts
export function setFallbackLocalEnabled(userSkillId: number | undefined, slug: string, enabled: boolean) {
  const entries = readLocalInstalls();
  writeLocalInstalls(entries.map((item) => {
    const matches = (userSkillId && item.userSkillId === userSkillId) || item.slug === slug;
    if (!matches) return item;
    return {
      ...item,
      enabledClaude: enabled,
      enabledCodex: false,
      updatedAt: new Date().toISOString(),
    };
  }));
}
```

- [ ] **步骤 3：运行测试确认通过**

```bash
cd desktop && npm test -- desktopBridge.test.ts --run
```

预期：通过。

### 任务 7：我的 Skills 页面改为使用 enabled 状态

**文件：**

- 修改：`desktop/src/pages/MySkillsPage.tsx`
- 测试：`desktop/src/pages/MySkillsPage.test.tsx`

- [ ] **步骤 1：写 UI 回归测试**

新增测试：

1. mock 一个广场 Skill。
2. mock 本地记录 enabled 为 true。
3. 点击“禁用”开关。
4. 断言调用 `setLocalSkillEnabled`。
5. 断言没有调用 `uninstallSkill`。

- [ ] **步骤 2：增加页面 helper**

```ts
function isViewEnabled(view: DesktopSkillView | null | undefined): boolean {
  return Boolean(view?.local?.enabledClaude || view?.local?.enabledCodex);
}
```

- [ ] **步骤 3：更新 `setLocalEnabled()`**

禁用时：

```ts
await setDesktopSkillEnabled(slug, id, false);
```

启用时：

```ts
await setDesktopSkillEnabled(slug, id, true);
```

如果启用报 `LOCAL_SKILL_CACHE_MISSING`，再走完整安装：

```ts
await install(view);
```

- [ ] **步骤 4：更新 Toggle checked**

`TeamSkillCard` 和 `SkillRow` 中：

```ts
const enabled = isViewEnabled(view);
```

不能再写：

```ts
const enabled = Boolean(view.local);
```

- [ ] **步骤 5：更新详情弹窗语义**

详情弹窗：

1. `installed` 表示真的启用到 Agent。
2. `added` 表示服务数据库有记录。

如果 `PlazaSkillDetailDialog` 已支持 `added`，传：

```tsx
installed={isViewEnabled(selectedView)}
added={Boolean(selectedView.cloud)}
```

如果还不支持，需要同步扩展弹窗 props。

- [ ] **步骤 6：运行测试确认通过**

```bash
cd desktop && npm test -- MySkillsPage.test.tsx --run
```

预期：通过。

### 任务 8：安装失败回滚保持完整清理语义

**文件：**

- 修改或确认：`desktop/src/pages/mySkillsGroups.ts`
- 测试：`desktop/src/pages/mySkillsGroups.test.ts`

- [ ] **步骤 1：写回滚测试**

场景：

1. 团队 Skill subscribe 成功。
2. 本地 install 失败。
3. 断言调用服务数据库 remove。
4. 断言调用完整本地删除清理。

核心断言：

```ts
expect(uninstall).toHaveBeenCalledWith('team-fail', 40);
expect(remove).toHaveBeenCalledWith(40);
```

- [ ] **步骤 2：运行测试**

```bash
cd desktop && npm test -- mySkillsGroups.test.ts --run
```

预期：通过。如果不通过，只修回滚路径。

- [ ] **步骤 3：命名上区分删除和禁用**

如果代码可读性不够，增加 wrapper：

```ts
export async function deleteDesktopSkillArtifacts(slug: string, userSkillId?: number): Promise<void> {
  await uninstallDesktopSkill(slug, userSkillId);
}
```

使用约束：

1. 删除流程和安装失败回滚可以使用它。
2. 禁用流程绝不能使用它。

### 任务 9：广场卡片和详情保持一致

**文件：**

- 修改：`desktop/src/pages/PlazaPage.tsx`
- 测试：`desktop/src/pages/PlazaPage.test.tsx`

- [ ] **步骤 1：补回归测试**

场景：

1. 服务数据库有记录。
2. 本地未启用或本地不存在。
3. 广场卡片显示 `√`。
4. 点击卡片打开详情。
5. 详情显示“已添加”语义，不显示“可安装”语义。

- [ ] **步骤 2：运行测试**

```bash
cd desktop && npm test -- PlazaPage.test.tsx --run
```

预期：通过。

### 任务 10：最终验证

- [ ] **步骤 1：运行目标测试**

```bash
cd desktop && npm test -- skillStore.test.ts status.test.ts desktopBridge.test.ts mySkillsGroups.test.ts PlazaPage.test.tsx MySkillsPage.test.tsx --run
```

预期：全部通过。

- [ ] **步骤 2：运行 TypeScript/lint**

```bash
cd desktop && npm run lint
```

预期：通过。

- [ ] **步骤 3：手工验证**

按以下顺序验证：

1. 从广场添加并安装一个 Skill。
2. 确认服务数据库有记录。
3. 确认 SQLite 有记录且 enabled 为 1。
4. 确认 `~/.skillstack/skills/<slug>` 存在。
5. 确认 Claude/Codex 目录有链接或副本。
6. 禁用 Skill。
7. 确认服务数据库记录仍存在。
8. 确认 SQLite 记录仍存在且 enabled 为 0。
9. 确认 `~/.skillstack/skills/<slug>` 仍存在。
10. 确认 Claude/Codex 目录下该 slug 已消失。
11. 确认广场卡片仍显示 `√`。
12. 确认详情显示“已添加/未启用”，不是“可安装”。
13. 启用 Skill。
14. 确认复用缓存目录并重建 Claude/Codex 目录链接或副本。
15. 切换软链接/复制方式。
16. 确认缓存目录内容未变化。
17. 确认 enabled 的 Skill 根据新方式重建 Agent 目录。
18. 确认 disabled 的 Skill 没有被重建到 Agent 目录。
19. 删除 Skill。
20. 确认服务数据库、SQLite、缓存目录、Agent 目录全部清理。

## 六、实现约束

1. 不做大范围重构。
2. 不改无关模块。
3. 禁用流程不得调用删除/卸载缓存的 API。
4. 删除流程必须清理四层状态。
5. 设置页切换软链接/复制方式不得修改缓存目录内容。
6. disabled Skill 不得因为设置切换被重新同步到 Claude/Codex。
7. 不再用 `Boolean(view.local)` 判断启用状态。
8. 保留当前工作区已有未提交改动，不回滚用户改动。

## 七、自检清单

需求覆盖：

1. 安装写服务数据库、SQLite、缓存、Agent 目录：任务 1、2、8、10 覆盖。
2. 本地安装失败回滚服务数据库和 SQLite：任务 8 覆盖。
3. 禁用保留缓存，只移除 Agent 目录：任务 2、3、7、10 覆盖。
4. 启用复用缓存并重建 Agent 目录：任务 2、7、10 覆盖。
5. 更新时 disabled 只更新缓存、不同步 Agent：任务 4、5、10 覆盖。
6. 删除清理四层状态：任务 7、8、10 覆盖。
7. 切换软链接/复制方式不动缓存：任务 4、10 覆盖。
8. 广场 `√` 和详情“已添加/已安装”语义：任务 5、7、9 覆盖。

待确认风险：

1. copy 模式下删除历史复制副本时，如果没有 `.skillstack-sync.json` 标记，只能通过 slug + `SKILL.md` 判断是否为 Skill 目录，可能误删用户手工创建的同名目录。
2. 如果要彻底避免误删，需要新增同步标记文件并兼容历史副本。

验证要求：

1. 至少运行任务 10 的目标测试。
2. 至少运行 `cd desktop && npm run lint`。
3. 手工验证禁用、启用、删除、切换同步方式四个关键路径。
