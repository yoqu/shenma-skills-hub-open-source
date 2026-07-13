# Desktop 日志 v2 诊断能力实施计划

> **执行要求：** 先按本计划逐项实施，保持测试先行；不新增事件码；不恢复高频成功流水日志。

**目标：** 让用户导出的 desktop 日志足以支持研发还原问题链路，并减少无诊断价值的噪声。

**设计依据：** `docs/superpowers/specs/2026-06-04-desktop-logging-design.md` 中的 “v2 诊断范围修订”。

---

## 当前上下文

- 第一版已经实现 `~/.skillstack/logs/skillstack-desktop.log` 文件日志。
- 第一版已经记录 API 失败 requestBody / responseBody。
- 第一版已经降低普通成功 IPC 日志噪声。
- 本轮补充的是诊断能力，不改变后端协议，不做远程日志上报。

## 任务 1：启动环境快照

**涉及文件：**

- 修改：`desktop/electron/main.cts`
- 修改或新增测试：`desktop/test/electron/*`

- [ ] **Step 1：写启动环境快照测试**

验证启动日志字段至少包含：

- appSessionId
- isDev
- platform
- arch
- logFilePath
- settingsPath
- databasePath
- skillHomeDir
- claudeSkillsDir
- codexSkillsDir
- syncMethod
- agents
- apiBaseUrl

- [ ] **Step 2：实现环境快照日志**

新增纯函数构造安全环境摘要，主进程 app ready 时写入。

- [ ] **Step 3：验证**

执行：

```bash
cd desktop && npm run test -- --run test/electron
cd desktop && npm run build:electron
```

## 任务 2：renderer 全局异常日志

**涉及文件：**

- 修改：`desktop/src/*`
- 修改：`desktop/electron/preload.cts`
- 修改：`desktop/src/skillstack-desktop.d.ts`
- 新增或修改测试：`desktop/test/src/*`

- [ ] **Step 1：写 renderer 错误日志测试**

覆盖：

- `window.onerror`
- `window.onunhandledrejection`
- bridge 调用失败

验证日志 payload 包含：

- level
- moduleName
- message
- route
- stack 摘要
- requestId，若存在

- [ ] **Step 2：实现 renderer error logger**

在 renderer 启动入口注册全局异常监听，通过 `window.skillstackDesktop.logEvent` 发送到主进程。

- [ ] **Step 3：验证**

执行：

```bash
cd desktop && npm run test -- --run test/src
cd desktop && npm run lint
```

## 任务 3：安装技能 step 级日志

**涉及文件：**

- 修改：`desktop/electron/main.cts`
- 修改：`desktop/electron/skillStore.ts`
- 修改测试：`desktop/test/electron/*`

- [ ] **Step 1：写 install 链路日志测试**

覆盖关键 step：

- install started
- package download / local copy
- package extracted
- staging created
- directory replaced
- metadata upserted
- sync to Claude/Codex
- install succeeded
- install failed

验证所有 step 共享 `installId`。

- [ ] **Step 2：实现 installId 和 step 日志**

在 install flow 入口生成 `installId`，贯穿 download、extract、replace、metadata、sync。

- [ ] **Step 3：记录安全数据**

记录：

- slug
- version
- source
- userSkillId
- skillId
- zipUrl，脱敏
- bytes
- extractDir
- stagingPath
- installPath
- target app
- syncMethod
- durationMs
- error / cause

不记录 zip 内容、图片内容、二进制内容。

- [ ] **Step 4：验证**

执行：

```bash
cd desktop && npm run test -- --run test/electron
cd desktop && npm run build:electron
```

## 任务 4：API fallback 去重和标识

**涉及文件：**

- 修改：`desktop/electron/apiProxy.ts`
- 修改：`desktop/src/api/client.ts`
- 修改测试：`desktop/test/electron/apiProxy.test.ts`
- 修改测试：`desktop/test/src/api/client.test.ts`

- [ ] **Step 1：写重复日志策略测试**

验证：

- 主进程 API 失败日志保留完整 requestBody / responseBody。
- renderer fallback 使用同一 requestId。
- renderer fallback 标记 `fallback=true`。
- 如果能确认主进程已记录，则 renderer fallback 只写简化摘要。

- [ ] **Step 2：实现 fallback 标识**

保持兜底能力，不删除 renderer fallback；通过字段区分主日志和兜底日志。

- [ ] **Step 3：验证**

执行：

```bash
cd desktop && npm run test -- --run test/electron/apiProxy.test.ts test/src/api/client.test.ts
```

## 任务 5：慢操作 WARN

**涉及文件：**

- 修改：`desktop/electron/apiProxy.ts`
- 修改：`desktop/electron/main.cts`
- 修改：`desktop/electron/skillStore.ts`
- 修改测试：`desktop/test/electron/*`

- [ ] **Step 1：写慢操作测试**

阈值：

- API 超过 3 秒
- install 超过 10 秒
- sync 超过 5 秒
- SQLite 操作超过 1 秒

验证超过阈值写 `WARN`，普通成功不写。

- [ ] **Step 2：实现慢操作检测**

通过 durationMs 和模块级阈值判断，不恢复普通成功流水。

- [ ] **Step 3：验证**

执行：

```bash
cd desktop && npm run test -- --run test/electron
```

## 任务 6：日志导出

**涉及文件：**

- 修改：`desktop/electron/main.cts`
- 修改：`desktop/electron/preload.cts`
- 修改：`desktop/src/skillstack-desktop.d.ts`
- 修改或新增 UI：`desktop/src/pages/*`
- 新增或修改测试：`desktop/test/electron/*`
- 新增或修改测试：`desktop/test/src/*`

- [ ] **Step 1：写日志导出测试**

验证导出包含：

- 当前 `skillstack-desktop.log`
- 轮转旧日志，若存在
- app/environment 安全摘要
- settings 安全摘要

验证导出不包含：

- SQLite 原始数据库
- skill 文件内容
- zip 包内容

- [ ] **Step 2：实现主进程导出 IPC**

新增：

```text
skillstack:logs:export
```

返回 zip 文件路径或下载结果。

- [ ] **Step 3：实现 UI 入口**

在 desktop 设置页或诊断区域提供“导出日志”入口。

- [ ] **Step 4：验证**

执行：

```bash
cd desktop && npm run test -- --run
cd desktop && npm run build:electron
cd desktop && npm run lint
```

## 任务 7：最终验证

- [ ] **Step 1：全量测试**

执行：

```bash
cd desktop && npm run test -- --run
```

- [ ] **Step 2：Electron 构建**

执行：

```bash
cd desktop && npm run build:electron
```

- [ ] **Step 3：TypeScript 检查**

执行：

```bash
cd desktop && npm run lint
```

- [ ] **Step 4：手工 smoke**

重启 dev Electron 后手工确认：

- 启动日志包含环境快照。
- 普通页面刷新不产生 `api:request` 成功噪声。
- API 失败包含 requestBody / responseBody。
- 安装技能日志包含 installId 和 step。
- renderer 抛错可以写入日志。
- 导出日志 zip 内容符合设计。
