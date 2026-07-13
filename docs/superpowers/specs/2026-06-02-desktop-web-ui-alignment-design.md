# 桌面端与 Web UI 对齐 + 共享设计系统 — 设计文档

- 日期：2026-06-02
- 范围：`packages/ui`（新增）、`frontend/`（仅入口 shim）、`desktop/`（逐页换血 + 交互打磨）
- 状态：已与用户确认设计方向，待写实现计划

## 1. 背景与目标

仓库内有两个 Vite + React + TypeScript 应用：

- `frontend/`：Web 端，拥有成熟设计系统 `frontend/src/components/ui/`（33 个组件），由 `TOKENS` 驱动、几乎全用**内联样式**落地外观（之所以用内联，是为了稳定压过 Tailwind Preflight 的未分层 author 规则）。
- `desktop/`：Electron 桌面客户端，独立项目，**没有** Tailwind/Radix/shadcn，用手写内联样式重新实现了一套外观，且数值与 Web 不一致（如文本色 `#111827` vs Web `#0F172A`、`fontWeight 750/850` vs Web `500`）。

用户目标（原话归纳）：

1. 桌面端 UI 样式与组件与 Web 对齐、保持一致。
2. 不做重复开发工作 —— 复用 Web 设计系统，而非再造或拷贝。
3. 优化桌面端整体页面交互。

关键事实（已勘探）：

- Web 的 ui 组件高度自包含：仅依赖 `react`、`@/components/icons`、`@/lib/utils`、`@/lib/visualAssets`、`@/lib/tokens`；33 个组件里只有 2 个 app-耦合（`Select`→Radix dropdown，`AvatarUpload`→`@/api`）。
- frontend 对设计系统的引用全部走 barrel：`@/components/ui'` 103 处、**0** 处按文件 import；`@/lib/tokens` 143 处、`@/components/icons` 87 处。
- 仓库**无根 `package.json`**，无 workspaces；两个 app 各自 `@ → ./src` 别名。
- 桌面端自造件仅三样：`components/Button.tsx`、`pages/pageHeaderStyles.ts`、`pages/transientScrollbar.ts`；其余卡片/徽章/输入是页面内手写内联；无 `EmptyState`/`Toast`，空/错/载状态临时拼装。

## 2. 决策记录（用户已选）

- **复用机制**：抽取共享包 `packages/ui`，作为设计系统唯一来源，frontend 与 desktop 都消费它。
- **共享深度**：只共享**原子层**（tokens + ui 通用组件 + icons + 必要 lib 工具）。桌面端页面自己组织布局，但全部换用同一套原子。
- **交互优化范围**：四个维度全要 —— 状态一致性、反馈与微动效、导航与信息架构、表单与输入体验。

## 3. 架构设计

### 3.1 共享包 `packages/ui`

- 包名 `@skillstack/ui`，目录 `packages/ui/`。
- **源码直连消费**，不做单独构建：每个 app 在 Vite `alias` + tsconfig `paths` 里把 `@skillstack/ui` 指向 `packages/ui/src`，Vite 直接编译 TS 源码。省掉打包/watch 复杂度。
- 根目录新增 `package.json` 声明 `workspaces: ["frontend", "desktop", "packages/*"]`，用于依赖提升与统一安装；解析仍以 Vite/tsconfig 别名为准。
- 子路径导出（`exports`）：
  - `@skillstack/ui`（barrel：ui 组件）
  - `@skillstack/ui/tokens`
  - `@skillstack/ui/icons`
  - `@skillstack/ui/utils`
  - `@skillstack/ui/visualAssets`

### 3.2 包内容（移入）

- `tokens.ts`、`icons.tsx`（自包含，仅 `react`）、`utils.ts`（`clsx` + `tailwind-merge`）、`visualAssets.ts`。
- `ui/` 下原子组件（约 33 个），**排除** `AvatarUpload`/`IconUpload`（依赖 `@/api`，留在 frontend 作为 app 专属）。
- `Select`（依赖 Radix dropdown）正常进包；`@radix-ui/react-dropdown-menu`、`clsx`、`tailwind-merge` 成为 `packages/ui` 的依赖。
- 新增轻量 `Spinner`/`Skeleton` 原子（当前 ui/ 没有载入态原子），两端共用。

被移动文件**内部**的 `@/...` 相对引用需改写为包内相对路径（约 33 个文件内部修改，非调用点）。

### 3.3 Web 端零改动策略（避开 150+ import churn）

不重写 frontend 任何调用点。把被移走的入口文件**就地改成再导出 shim**：

- `frontend/src/components/ui/index.ts` → `export * from '@skillstack/ui'`
- `frontend/src/lib/tokens.ts` → `export * from '@skillstack/ui/tokens'`
- `frontend/src/components/icons.tsx` → `export * from '@skillstack/ui/icons'`
- `frontend/src/lib/utils.ts` → 再导出 `@skillstack/ui/utils`（若含 app 专属 helper，则 `export * from` 包 + 保留本地补充）
- `frontend/src/lib/visualAssets.ts` → 再导出 `@skillstack/ui/visualAssets`
- `AvatarUpload`/`IconUpload` 仍由 `frontend/src/components/ui/index.ts` 一并导出（一个来自包、两个来自本地），保证 barrel 对外形状不变。

效果：103 处 `@/components/ui`、143 处 `@/lib/tokens`、87 处 `@/components/icons` **原样可用，零调用点改动**。

替代方案（未采纳）：用 codemod 把 frontend 全部 import 重写为 `@skillstack/ui`。更彻底但风险大、收益低，无必要。

## 4. 桌面端换血映射

| 桌面现状 | 替换为 | 处置 |
|---|---|---|
| `components/Button.tsx`（primary/secondary，#111827，fw750） | `@skillstack/ui` `Button`（变体为其超集） | 删除，全量替换 |
| `pages/pageHeaderStyles.ts`（pageTitle/subtitle，#111827/fw850） | `SectionHeader` + `TOKENS`（text/text2） | 删除，统一字号字重色值 |
| 页面手写卡片/徽章/输入/搜索框 | `Card` / `Badge` / `Input` / `SearchInput` / `SkillCard` / `SkillIcon` / `Stat` / `Divider` | 逐页替换 |
| `pages/transientScrollbar.ts`（Electron 滚动条手感） | **保留**，桌面专属 UX | 不动 |

涉及页面：`DesktopLogin`、`DesktopLayout`、`DesktopSettingsPage`、`MySkillsPage`、`PlazaPage`、`RecommendationsPage`。

## 5. 四个交互维度落地

1. **状态一致性**：空/错/未登录态统一走 `EmptyState`，瞬时反馈走 `Toast`，表单错误走 `FormField`/`FormError`。载入态统一走新增 `Spinner`/`Skeleton` 原子。
2. **反馈与微动效**：交互件统一用 `Pressable`/`IconButton`/`Button` 自带 hover/focus/pressed 与过渡；保留 `transientScrollbar`。
3. **导航与信息架构**：`DesktopLayout` 侧边导航激活态、页头层级用 `SectionHeader` 对齐；修冷启动白屏 —— 当前 react-query `refetchOnMount: 'always'` 会闪，改为保留缓存 + 骨架过渡。
4. **表单与输入**：登录/设置/导入技能改用 `FormField`+`Input`+`FormError`，验证码/手机号复用 `OtpInput`/`PhoneInput`，补键盘可达性 + 提交态（Button loading + Toast）。

## 6. 落地顺序（每步独立可验证、可回滚）

1. **建包 + shim**：创建 `packages/ui`、根 workspaces、两端别名；移文件、改包内相对引用、frontend 入口改 shim。不改任何观感。
2. **桌面逐页换血**：按页用共享原子替换手写内联，删除 `Button.tsx`/`pageHeaderStyles.ts`。
3. **四维交互打磨**：状态/微动效/导航/表单逐项落地。

## 7. 验证

- **第一关（证明 shim 成立）**：`cd frontend && npm run lint && npm run build` 必须照常绿。
- 桌面端：`cd desktop && npm run lint`（tsc）、`npm test`（vitest）、`vite build`，再做 Electron 冷启动 smoke（路由可开、关键数据渲染、主要按钮不立刻报错）。
- 区分回归来源：本次改动 / 既有未提交改动 / 环境依赖，不在未真实验证时声称通过。

## 8. 已知风险

- Web 组件用内联样式是为压过 Tailwind Preflight；桌面无 Preflight，内联样式本身不依赖它，但个别组件可能依赖基础 reset —— smoke 时重点核对（桌面 `styles.css` 已有 box-sizing 与 button/input 字体 reset）。
- `clsx`/`tailwind-merge`/Radix 作为包依赖被桌面拉入，体积可接受。
- Electron 打包消费的是 `vite build` 产物，只要 Vite 解析别名成功即可，无额外构建链路。

## 9. 不在本次范围

- 不重写 frontend 调用点（靠 shim）。
- 不共享页面级/功能级组件（仅原子层）。
- `AvatarUpload`/`IconUpload` 不进包。
- 不引入 Tailwind 到桌面端。
