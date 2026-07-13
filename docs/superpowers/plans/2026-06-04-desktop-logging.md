# Desktop 日志记录实施计划

> **执行要求：** 按任务逐项实施，并使用复选框（`- [ ]`）跟踪状态；实施时使用 `superpowers:executing-plans` 或等效的计划执行流程。

**目标:** 为 SkillStack desktop 实现本地文件日志，覆盖主进程生命周期、IPC、本地 skill 操作、后端 API 失败 request/response body，以及 renderer 兜底日志。

**架构:** 使用 `electron-log` 作为文件落盘 sink，在 `desktop/electron/logger.ts` 封装格式化、脱敏、限长和测试 writer。API 失败日志以主进程 `desktop/electron/apiProxy.ts` 为主，renderer axios interceptor 只做兜底，统一通过 `skillstack:log:event` 交给主进程写入 `~/.skillstack/logs/skillstack-desktop.log`。

**技术栈:** Electron main process、React renderer、TypeScript、Axios、Vitest、electron-log。

---

## 当前上下文

- 设计文档：`docs/superpowers/specs/2026-06-04-desktop-logging-design.md`
- 当前已有未提交改动涉及 `desktop/electron/main.cts` 的窗口聚焦和 `desktop/package.json` 的 mac icon，这些不是本次日志实现，不要回滚。
- 本次实现需要继续修改 `desktop/package.json` 和 `desktop/package-lock.json` 添加 `electron-log`。
- 第一版不设计事件码，日志格式为 `[YYYY-MM-DD][HH:mm:ss][LEVEL][module] message key=value ...`。

## 文件职责

- 新增 `desktop/electron/logger.ts`：统一日志封装、脱敏、限长、格式化、测试 writer。
- 新增 `desktop/electron/logger.test.ts`：验证格式、脱敏、body 截断、FormData 摘要、错误序列化。
- 修改 `desktop/electron/apiProxy.ts`：记录 API network/HTTP/envelope 失败，保留现有响应行为。
- 修改 `desktop/electron/apiProxy.test.ts`：补 API 失败日志覆盖。
- 修改 `desktop/electron/main.cts`：初始化 logger、包装 IPC、注册 renderer log bridge、记录生命周期和直接下载失败。
- 修改 `desktop/electron/preload.cts`：暴露 `logEvent`。
- 修改 `desktop/src/skillstack-desktop.d.ts`：补 `logEvent` 类型。
- 修改 `desktop/src/api/client.ts`：生成 requestId，传入主进程代理；axios 失败时通过 bridge 兜底记录。
- 修改 `desktop/src/api/client.test.ts`：验证 requestId 传递和 renderer 兜底日志。
- 修改 `desktop/electron/skillStore.ts`：记录 settings、SQLite、metadata、sync、enable/disable/resync 关键失败和结果摘要。
- 修改 `desktop/electron/skillStore.test.ts`：验证关键 store 日志调用。

## 任务 1：安装日志依赖

**涉及文件：**
- Modify: `desktop/package.json`
- Modify: `desktop/package-lock.json`

- [x] **Step 1: 安装 `electron-log`**

执行：

```bash
cd desktop && npm install electron-log
```

预期：

```text
added ... electron-log ...
```

- [x] **Step 2: 确认依赖只追加必要内容**

执行：

```bash
git diff -- desktop/package.json desktop/package-lock.json
```

预期：

```text
dependencies 中新增 "electron-log"
package-lock 中新增 electron-log 解析信息
已有 mac icon 改动仍保留
```

## 任务 2：编写 logger 失败测试

**涉及文件：**
- Create: `desktop/electron/logger.test.ts`
- Create: `desktop/electron/logger.ts`

- [x] **Step 1: 写 logger 行格式、脱敏和截断测试**

Create `desktop/electron/logger.test.ts` with tests for:

```ts
import { describe, expect, it } from 'vitest';
import {
  createMemoryLogWriter,
  createDesktopLogger,
  sanitizeForLog,
  summarizeBodyForLog,
} from './logger';

describe('desktop logger', () => {
  it('formats lines with date, time, level, module, message and fields', () => {
    const writer = createMemoryLogWriter();
    const logger = createDesktopLogger({
      writer,
      now: () => new Date('2026-06-04T02:12:33.000Z'),
    });

    logger.error('skillstack_desktop::api', 'POST /api/user-skills/import failed', {
      status: 400,
      durationMs: 128,
      requestId: 'api_1',
    });

    expect(writer.lines[0]).toBe(
      '[2026-06-04][02:12:33][ERROR][skillstack_desktop::api] POST /api/user-skills/import failed status=400 durationMs=128 requestId=api_1',
    );
  });

  it('redacts credentials but keeps backend envelope code visible', () => {
    expect(sanitizeForLog({
      password: 'secret',
      token: 'abc',
      code: 40004,
      nested: { verificationCode: '123456' },
    })).toEqual({
      password: '<redacted>',
      token: '<redacted>',
      code: 40004,
      nested: { verificationCode: '<redacted>' },
    });
  });

  it('summarizes large bodies with truncation metadata', () => {
    const result = summarizeBodyForLog({ value: 'x'.repeat(20) }, { maxLength: 12 });
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(12);
  });
});
```

- [x] **Step 2: 创建空实现并验证 RED**

Create `desktop/electron/logger.ts` with empty exports that throw:

```ts
export function createMemoryLogWriter(): never {
  throw new Error('not implemented');
}

export function createDesktopLogger(): never {
  throw new Error('not implemented');
}

export function sanitizeForLog(): never {
  throw new Error('not implemented');
}

export function summarizeBodyForLog(): never {
  throw new Error('not implemented');
}
```

执行：

```bash
cd desktop && npm run test -- electron/logger.test.ts
```

预期：

```text
FAIL desktop/electron/logger.test.ts
```

Failure should be caused by `not implemented`.

## 任务 3：实现 logger 核心

**涉及文件：**
- Modify: `desktop/electron/logger.ts`
- Test: `desktop/electron/logger.test.ts`

- [x] **Step 1: 实现最小 logger**

Implement:

- `createMemoryLogWriter`
- `createDesktopLogger`
- `sanitizeForLog`
- `summarizeBodyForLog`
- default file logger factory using `electron-log`

Key API:

```ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type DesktopLogger = {
  debug(moduleName: string, message: string, fields?: Record<string, unknown>): void;
  info(moduleName: string, message: string, fields?: Record<string, unknown>): void;
  warn(moduleName: string, message: string, fields?: Record<string, unknown>): void;
  error(moduleName: string, message: string, fields?: Record<string, unknown>): void;
};
```

- [x] **Step 2: 验证 GREEN**

执行：

```bash
cd desktop && npm run test -- electron/logger.test.ts
```

预期：

```text
PASS desktop/electron/logger.test.ts
```

## 任务 4：API proxy 失败日志

**涉及文件：**
- Modify: `desktop/electron/apiProxy.ts`
- Modify: `desktop/electron/apiProxy.test.ts`
- Test: `desktop/electron/apiProxy.test.ts`

- [x] **Step 1: 写 API proxy RED 测试**

Add tests that inject a memory logger into `proxyApiRequest`:

```ts
it('logs HTTP failures with request and response bodies', async () => {
  const writer = createMemoryLogWriter();
  const logger = createDesktopLogger({ writer, now: () => new Date('2026-06-04T02:12:33.000Z') });
  const fetcher = async () => new Response(JSON.stringify({ code: 40004, message: 'slug invalid' }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });

  await proxyApiRequest({
    method: 'POST',
    url: '/user-skills/import',
    body: { slug: 'bad slug', token: 'secret' },
  }, 'http://localhost:8080', fetcher, { logger, requestId: 'api_1' });

  expect(writer.lines.join('\n')).toContain('POST /api/user-skills/import failed');
  expect(writer.lines.join('\n')).toContain('requestBody={"slug":"bad slug","token":"<redacted>"}');
  expect(writer.lines.join('\n')).toContain('responseBody={"code":40004,"message":"slug invalid"}');
});
```

执行：

```bash
cd desktop && npm run test -- electron/apiProxy.test.ts
```

预期：

```text
FAIL because proxyApiRequest does not accept logger options yet
```

- [x] **Step 2: 实现 API proxy 日志**

Extend `proxyApiRequest` signature with optional logger context:

```ts
type ApiProxyLogContext = {
  logger?: DesktopLogger;
  requestId?: string;
};
```

Log:

- network failure
- HTTP failure
- envelope failure where JSON `code` is not `0` or `200`

- [x] **Step 3: 验证 API proxy 测试通过**

执行：

```bash
cd desktop && npm run test -- electron/apiProxy.test.ts
```

预期：

```text
PASS desktop/electron/apiProxy.test.ts
```

## 任务 5：主进程 logger、IPC 和下载日志

**涉及文件：**
- Modify: `desktop/electron/main.cts`
- Modify: `desktop/electron/preload.cts`
- Modify: `desktop/src/skillstack-desktop.d.ts`

- [x] **Step 1: 写 IPC wrapper 可测逻辑**

Extract pure helper if needed:

```ts
function createLoggedDesktopOperationHandler(...)
```

Test with direct function invocation or existing main-process tests.

- [x] **Step 2: 接入主进程 logger**

In `main.cts`:

- initialize logger before registering IPC
- register `skillstack:log:event`
- pass logger into `proxyApiRequest`
- log direct skill package download failures
- log lifecycle events and renderer failures

- [x] **Step 3: 更新 preload 和类型**

Expose:

```ts
logEvent: (event: SkillstackDesktopLogEvent) => Promise<SkillstackDesktopResult<{ logged: boolean }>>;
```

## 任务 6：Axios requestId 和兜底日志

**涉及文件：**
- Modify: `desktop/src/api/client.ts`
- Modify: `desktop/src/api/client.test.ts`

- [x] **Step 1: 写 client RED 测试**

Add tests for:

- requestId is sent through `apiRequest`
- renderer fallback calls `logEvent` when envelope/axios failure happens
- request body is included and credentials are redacted by main logger path

- [x] **Step 2: 实现 requestId 和 fallback**

Implementation:

- request interceptor assigns `metadata.requestId`
- `toDesktopApiRequest` includes requestId
- response/error interceptor calls `window.skillstackDesktop.logEvent` for fallback failures

- [x] **Step 3: 验证 client 测试**

执行：

```bash
cd desktop && npm run test -- src/api/client.test.ts
```

预期：

```text
PASS desktop/src/api/client.test.ts
```

## 任务 7：skillStore 关键日志

**涉及文件：**
- Modify: `desktop/electron/skillStore.ts`
- Modify: `desktop/electron/skillStore.test.ts`

- [x] **Step 1: 写 store RED 测试**

Cover:

- settings save logs safe summary
- enable/disable logs slug and target agents
- resync logs synced count
- sync failure logs slug and app target

- [x] **Step 2: 实现 store 日志注入**

Use module-level logger setter or optional dependency injection for tests. Keep production calls simple.

- [x] **Step 3: 验证 store 测试**

执行：

```bash
cd desktop && npm run test -- electron/skillStore.test.ts
```

预期：

```text
PASS desktop/electron/skillStore.test.ts
```

## 任务 8：汇总验证

**涉及文件：**
- All changed desktop files

- [x] **Step 1: 跑直接相关测试**

执行：

```bash
cd desktop && npm run test -- electron/logger.test.ts electron/apiProxy.test.ts src/api/client.test.ts electron/skillStore.test.ts
```

预期：

```text
PASS
```

- [x] **Step 2: 跑 Electron 构建**

执行：

```bash
cd desktop && npm run build:electron
```

预期：

```text
tsc -p tsconfig.electron.json 成功
dist-electron 生成成功
```

- [x] **Step 3: 范围自检**

执行：

```bash
git status --short
git diff --stat
```

预期：

```text
只出现日志实现相关文件，加上工作区原本已有的 unrelated dirty 文件
```
