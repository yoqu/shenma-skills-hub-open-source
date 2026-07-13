# Desktop 日志记录设计

## 背景

SkillStack desktop 当前是 Electron 桌面应用。renderer 使用 React、Axios；具备本地权限的逻辑运行在 Electron 主进程中，包括 skill 安装/卸载、SQLite 元数据、设置读写、Claude/Codex skill 目录同步、文件选择、窗口模式切换，以及后端 API 代理请求。

参考项目 `farion1231/cc-switch` 使用的是第三方日志落盘能力（`tauri-plugin-log`）加 Rust `log` facade。它的生产日志是事件化、文件化的，格式类似：

```text
[2026-06-03][10:46:42][INFO][cc_switch_lib::services::proxy] message
```

SkillStack desktop 应采用同样的日志策略，但按 Electron 技术栈实现：

- 使用第三方文件日志库作为落盘 sink。
- 外面包一层项目自己的 logger，统一格式、脱敏和模块名。
- 记录足够诊断生产问题的上下文，同时不明文暴露凭证。

## 目标

- 将 desktop 诊断日志写入 `~/.skillstack/logs/skillstack-desktop.log`。
- 覆盖 Electron 主进程生命周期、IPC、本地文件/SQLite 操作、skill 生命周期操作和后端 API 调用失败。
- 后端 API 调用失败时记录 request body 和 response body，并做强制脱敏与限长。
- 提供 request/operation/install 级别的关联 ID，方便把 renderer、IPC、API proxy 和日志串起来。
- 不改变现有用户可见行为。日志不能改变 API 响应、IPC 返回值或安装逻辑。
- 改动范围保持在 `desktop/` 内，不做无关重构。

## 非目标

- 第一版不记录每个成功的后端 API 请求。
- 不记录原始凭证、token、cookie 或二进制文件内容。
- 第一版不增加设置页里的日志开关、日志级别或打开日志目录 UI。
- 不修改后端 API 协议。
- 不做远程日志上报或 telemetry。

## 总体架构

### 日志落盘

使用 `electron-log` 作为文件日志 sink，在主进程新增项目封装：

```text
desktop/electron/logger.ts
```

封装层负责：

- 日志文件路径解析
- cc-switch 风格格式化
- 模块名
- request/response body 序列化
- 递归脱敏
- body 长度限制
- Error 序列化
- 日志级别过滤
- 文件轮转配置
- 测试 writer hook

业务代码只调用项目封装，不直接调用 `electron-log`。

### 日志文件

默认文件路径：

```text
~/.skillstack/logs/skillstack-desktop.log
```

默认日志级别：

```text
info
```

轮转策略：

- 单个日志文件最大 5 MB。
- 最多保留 5 个文件。
- 如果 `electron-log` 内置轮转能力不能完全匹配该策略，实现时采用最接近的内置能力，并在实现说明中写清楚实际行为。

### 日志格式

每条日志使用固定前缀：

```text
[YYYY-MM-DD][HH:mm:ss][LEVEL][module] message key=value ...
```

API 失败日志示例：

```text
[2026-06-04][10:12:33][ERROR][skillstack_desktop::api] POST /api/user-skills/import failed status=400 durationMs=128 requestId=api_... requestBody={"name":"Demo","slug":"bad slug"} responseBody={"code":40004,"message":"slug invalid"}
```

关键要求：同一次 API 失败必须能通过 `requestId` 快速 grep 到完整上下文。

## 数据流设计

### 主进程生命周期

logger 必须尽早初始化：早于 IPC handler 注册，也早于 BrowserWindow 创建。

需要记录：

- app start
- logger initialized
- 日志路径和基础配置摘要
- IPC handlers registered
- main window created
- dev URL 或 packaged file load target
- window show/focus 失败
- app activate
- window-all-closed
- process `uncaughtException`
- process `unhandledRejection`
- renderer `console-message` 的 warn/error
- renderer `render-process-gone`
- renderer `did-fail-load`

### IPC 操作

当前通用封装：

```text
handleDesktopOperation(operation)
```

应改为日志感知封装：

```text
handleDesktopOperation(channel, input, operation)
```

记录内容：

- 开始：channel、operationId、入参安全摘要
- 成功：channel、operationId、durationMs、必要时记录安全结果摘要
- 失败：channel、operationId、durationMs、desktop error code、message、cause 摘要

不改变现有 `DesktopResult<T>` 结构。

### 后端 API 请求

当前 renderer 已经在 `desktop/src/api/client.ts` 使用 `createDesktopAwareAdapter()`。在 Electron 模式下，Axios 请求实际链路是：

```text
window.skillstackDesktop.apiRequest(...)
ipcMain.handle('skillstack:api:request', ...)
desktop/electron/apiProxy.ts
fetch(...)
```

因此后端 API 失败日志的主入口必须放在 `desktop/electron/apiProxy.ts`，不能只靠 Axios interceptor。

API proxy 需要记录：

- method
- 标准化后的 path
- 脱敏后的 query 参数
- 脱敏后的 request body
- response status
- 脱敏后的 response body
- durationMs
- requestId
- network/fetch error 摘要

API proxy 必须记录三类失败：

- network failure：fetch 抛错或 Electron 访问不到后端
- HTTP failure：status 小于 200 或大于等于 400
- business envelope failure：响应 JSON 包含 `code`，且 `code` 不是 `0` 或 `200`

API proxy 只记录日志，不改变响应。

### Axios 兜底

保留 renderer 侧 Axios error interceptor 作为兜底，用于：

- 非 Electron 浏览器模式
- 未来绕过 `apiRequest` 的调用
- proxy 成功后由现有 response interceptor 抛出的错误，包括 envelope 处理

Electron 模式下，renderer 兜底日志通过安全 bridge 发给主进程：

```text
window.skillstackDesktop.logEvent(...)
ipcMain.handle('skillstack:log:event', ...)
```

主进程写日志前必须校验 payload。renderer 不能传任意 module 名，也不能传原始文件。只允许已知 renderer 日志类型，例如：

- `api_failure`
- `runtime_error`
- `console_error`

### Skill 包下载请求

`desktop/electron/main.cts` 中的 skill 包下载使用直接 `fetch(input.zipUrl, { headers })`，不经过 Axios，也不经过 `apiProxy`。

需要记录：

- 本地复制 start/success/failure
- HTTP download start/success/failure
- 脱敏后的 URL
- response status
- 下载字节数
- durationMs
- installId

不能记录 Authorization header 或 signed URL 的完整 query value。

## 脱敏规则

脱敏必须集中在 `desktopLogger` 内部完成，不能依赖业务调用点自行判断。

递归脱敏以下 key：

```text
password
passwd
token
authToken
accessToken
refreshToken
authorization
cookie
set-cookie
secret
credential
captcha
smsCode
otp
verificationCode
deviceCode
userCode
```

匹配大小写不敏感。

不要默认脱敏通用字段 `code`。后端 envelope 里的 `{"code":40004}` 是诊断信息，必须保留。只有字段名明显表示验证码或认证码时才脱敏。

URL query 处理：

- 非敏感 key/value 可以记录，但 value 必须较短且不含敏感内容。
- 敏感 query value 必须脱敏。
- signed URL 优先记录 key-only 形式：

```text
https://example.com/path?[keys:expires,signature]
```

Header 处理：

- 永远不记录 Authorization、Cookie、Set-Cookie 的值。
- 只在有价值时记录安全 header，例如 content-type。

文件处理：

- FormData 文件项只记录 `fieldName`、`fileName`、`mimeType` 和 `size`。
- 永远不记录二进制内容。

## 大小限制

单个 request body：

- 最大 16 KB
- 截断时标记 `truncated=true`

单个 response body：

- 最大 16 KB
- 截断时标记 `truncated=true`

单个 stack trace：

- 最大 12 KB

所有限制在写入日志 sink 之前完成。

## 关联 ID

生成以下 ID：

- `appSessionId`：app 启动时生成，必要时附加到日志上下文。
- `requestId`：每次 API 请求生成。
- `operationId`：每次 IPC 操作生成。
- `installId`：每次 install flow 生成，并贯穿 download、extract、replace、metadata、sync 日志。

如果 API 请求经过主进程代理，renderer 生成的 `requestId` 应传入 `apiRequest`。如果缺失，则由主进程生成。

未来后端可以支持 `X-Request-Id` 以便前后端日志对齐，但本设计不要求修改后端。

## 错误处理原则

日志不能影响业务流程。

规则：

- 写日志失败时吞掉日志错误。
- logger 内部失败不能递归打日志。
- 保持现有 `DesktopResult` 错误映射。
- 保持现有 Axios `ApiError` 行为。
- 保持 `desktop/src/api/client.ts` 中的 session reset 行为。

## 预计改动文件

实施阶段预计涉及：

```text
desktop/package.json
desktop/package-lock.json
desktop/electron/logger.ts
desktop/electron/logger.test.ts
desktop/electron/main.cts
desktop/electron/apiProxy.ts
desktop/electron/apiProxy.test.ts
desktop/electron/preload.cts
desktop/electron/skillStore.ts
desktop/electron/skillStore.test.ts
desktop/src/api/client.ts
desktop/src/api/client.test.ts
desktop/src/skillstack-desktop.d.ts
```

第一版不需要修改后端文件。

## 测试策略

### 单元测试

logger 测试：

- cc-switch 风格前缀格式
- module 输出
- 递归脱敏
- URL 脱敏
- body 截断
- Error 序列化
- 文件/FormData body 摘要

API proxy 测试：

- network failure 记录 request body
- HTTP failure 记录 request body 和 response body
- HTTP 200 但 envelope code 非 0/200 时记录业务失败
- token/password/认证码字段脱敏
- 后端 envelope `code` 保持可见
- FormData 文件只记录元数据，不记录二进制
- 保持现有 proxy response 行为

IPC 测试：

- operation success 记录 duration 和 channel
- operation failure 记录 channel、error code 和安全入参摘要
- log event bridge 拒绝未知 event kind

Skill store 测试：

- settings save 记录安全配置摘要
- enable/disable 记录目标 agents
- resync 记录 synced count
- sync failure 记录 slug 和 app target

### 验证命令

实施完成后应运行：

```bash
cd desktop && npm run test -- logger
cd desktop && npm run test -- apiProxy
cd desktop && npm run test -- client
cd desktop && npm run test -- skillStore
cd desktop && npm run build:electron
```

如果改动跨 renderer/main 类型边界，再运行：

```bash
cd desktop && npm run lint
```

## 发布说明

- 第一版默认日志级别为 `info`。
- 第一版固定日志路径，不提供 UI 配置。
- 在文件日志行为稳定前，不增加设置页控制项。
- 除非后续明确要求审计所有请求，否则不记录成功 API 请求。

## 风险与边界

- request/response body 可能包含个人数据。为了诊断失败，这部分会记录；但凭证和认证字段必须脱敏。
- 大 response body 可能增加磁盘占用，因此 body 截断和日志轮转是启用 API body 日志前的硬性要求。
- 某些失败可能发生在 logger 初始化前。实现时要尽早初始化 logger，并尽快注册 process 级异常处理。
- 非 Electron 浏览器 fallback 模式无法写本地日志。该功能目标是 desktop，因此可接受。

## v2 诊断范围修订

### 诊断目标

desktop 日志的核心目标不是记录所有动作，而是让用户导出日志后，研发可以还原问题链路：

- 用户当时做了什么。
- 桌面端处于什么运行环境和配置状态。
- 后端请求、文件操作、SQLite、本地同步在哪一步失败。
- 失败输入是什么，失败结果是什么。
- 哪些数据可以用于修复问题，哪些只是噪声。

因此日志应作为“证据链”，不是操作流水账。

### 必须记录的范围

#### 启动环境快照

每次启动记录一次环境快照：

- `appSessionId`
- app version
- `isDev` / packaged
- platform、arch
- Electron / Node 版本
- log file path
- settings path
- SQLite database path
- skill home dir
- Claude/Codex skill dir
- sync method
- enabled agents
- API base URL，脱敏后记录

用途：排查版本、平台、路径、权限、配置和运行模式差异。

#### 用户关键操作

记录用户主动触发且会改变状态的操作：

- 登录、退出、登录失效、登录恢复
- 安装技能
- 卸载技能
- 启用技能
- 禁用技能
- 保存配置
- 重新同步
- 打开安装目录
- 选择本地文件
- 导入个人技能
- 从广场添加技能

记录颗粒度：

- operation name
- `operationId`
- `requestId`
- `installId`，安装链路专用
- slug
- userSkillId
- source
- version
- target agents
- sync method
- started / succeeded / failed
- durationMs

#### 后端 API 失败

API 失败必须详细记录。失败包括：

- network error
- timeout
- HTTP 4xx / 5xx
- 后端 envelope code 非成功
- auth reset

记录颗粒度：

- requestId
- method
- normalized path
- status
- backend envelope code
- durationMs
- requestBody，脱敏并截断
- responseBody，脱敏并截断
- error name/message/stack 摘要

成功 API 默认不记录。只有关键业务操作成功后需要记录业务摘要时，才由业务模块记录，不由 API proxy 记录普通成功请求。

#### 安装技能全链路

安装技能是 desktop 最复杂、最容易受用户环境影响的链路，必须记录 step 级日志。

安装链路步骤：

- install started
- local package copied 或 remote package download started
- remote package downloaded
- package extracted
- skill metadata parsed
- staging directory created
- old skill backed up
- skill directory replaced
- SQLite metadata upserted
- sync to Claude started/succeeded/failed
- sync to Codex started/succeeded/failed
- install succeeded
- install failed

记录颗粒度：

- installId
- slug
- version
- source
- userSkillId
- skillId
- zipUrl，脱敏后
- local package path，必要时记录
- zip bytes
- extract dir
- staging path
- target install path
- target app dir
- sync method
- enabled agents
- current step
- durationMs
- error / cause

文件内容和 zip 二进制永远不记录。

#### 本地存储与同步失败

必须记录：

- settings 保存失败
- SQLite 初始化失败
- SQLite migration 失败
- SQLite SQL 执行失败，记录操作名，不记录完整 SQL 中可能包含的用户数据
- 本地 skill cache 缺失
- symlink 失败
- copy 失败
- 删除旧同步目录失败
- 路径越界保护触发

记录颗粒度：

- slug
- userSkillId
- source
- installPath
- targetPath
- target app
- sync method
- error code/message

#### renderer 运行时异常

必须补充 renderer 全局错误日志：

- `window.onerror`
- `window.onunhandledrejection`
- React 关键操作失败 fallback
- preload bridge 调用失败
- renderer `did-fail-load`
- renderer `render-process-gone`

记录颗粒度：

- route
- message
- stack 摘要
- operation name
- requestId，若有
- user action context，若有

### 选择性记录的范围

#### 慢操作 WARN

慢操作比普通成功日志更有诊断价值。

建议阈值：

- API 超过 3 秒
- install 超过 10 秒
- sync 超过 5 秒
- SQLite 操作超过 1 秒

超过阈值记录 `WARN`，包含 operation、durationMs 和安全上下文。

#### 关键成功摘要

只记录用户可感知、会改变状态的成功结果：

- install succeeded
- uninstall succeeded
- skill enabled / disabled
- settings saved
- resync succeeded
- login restored

不记录普通读取成功。

### 不应记录的范围

不记录以下成功流水：

- `api:request` 普通成功
- `config:get` 成功
- `local-installs:list` 成功
- `window:mode` 成功
- `log:event` 成功
- `/me`、`/skills`、`/user-skills` 普通成功
- 页面刷新和窗口激活触发的成功请求

不记录以下敏感或高风险数据：

- token
- Authorization
- Cookie / Set-Cookie
- 密码
- 验证码
- secret
- zip 文件内容
- 图片内容
- 任意二进制内容
- 用户本地文件完整内容

### API fallback 去重

主进程 API proxy 是 Electron 模式下的主日志入口。renderer Axios fallback 只用于兜底。

为了避免同一次 API 失败重复误导分析：

- 主进程 API 失败日志保留完整 requestBody / responseBody。
- renderer fallback 日志保留，但必须标记为 fallback。
- renderer fallback 如果能确认 requestId 已由主进程记录，可以只记录简化摘要。
- 两条日志必须共享 requestId，便于 grep 后合并理解。

### 日志导出

desktop 应提供日志导出能力，便于用户提交问题。

导出内容：

- 当前 `skillstack-desktop.log`
- 轮转旧日志，如果存在
- settings 安全摘要
- app/environment 安全摘要

导出格式：

- zip 文件
- 文件名包含日期时间，例如 `skillstack-desktop-logs-20260604-140000.zip`

导出规则：

- 导出前不二次压缩二进制 skill 包。
- 不包含用户 skill 文件内容。
- 不包含 SQLite 原始数据库，除非后续明确设计脱敏导出。

### 当前实现缺口

当前第一版已经覆盖：

- 文件日志
- API 失败 requestBody / responseBody
- requestId
- renderer API fallback
- install download 失败
- store settings / enable / disable / resync / sync failure
- 高频成功 IPC 降噪

仍需补充：

- renderer 全局异常日志
- 启动环境快照
- install step 级日志
- API fallback 去重或明确标识
- 慢操作 WARN
- 日志导出 IPC 和 UI 入口
