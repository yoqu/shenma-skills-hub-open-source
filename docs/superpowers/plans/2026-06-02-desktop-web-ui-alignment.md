# Desktop ↔ Web UI Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 抽取 `packages/ui` 共享设计系统，让 Web 端零调用点改动，并用同一套原子组件重建桌面端页面、统一交互体验。

**Architecture:** 新建 `packages/ui`（包名 `@skillstack/ui`），把 tokens + 自包含 ui 原子 + icons + 必要 lib 工具作为唯一来源，两端通过 Vite alias + tsconfig paths 源码直连消费。frontend 的入口文件改成再导出 shim，保证 103 处 `@/components/ui`、143 处 `@/lib/tokens`、87 处 `@/components/icons` 原样可用。桌面端逐页换血并补齐四个交互维度。

**Tech Stack:** Vite, React 18, TypeScript 5, Electron 33, TanStack Query, Radix UI(dropdown), clsx + tailwind-merge, vitest。

**Spec:** `docs/superpowers/specs/2026-06-02-desktop-web-ui-alignment-design.md`

**分支:** 实现前先建 `feat/desktop-ui-alignment`（当前在 `develop`）。

---

## File Structure

新建：
- `package.json`（仓库根，仅声明 workspaces）
- `packages/ui/package.json` — 包定义与 `exports`
- `packages/ui/tsconfig.json`
- `packages/ui/src/index.ts` — ui 原子 barrel
- `packages/ui/src/tokens.ts`、`icons.tsx`、`utils.ts`、`visualAssets.ts`（从 frontend 移入）
- `packages/ui/src/components/*.tsx` — 移入的 ui 原子（含 `TeamAvatar`、解耦后的 `SkillCard`）
- `packages/ui/src/components/Spinner.tsx`、`Skeleton.tsx`（新增载入态原子）

修改（frontend，仅入口 shim 与配置）：
- `frontend/vite.config.ts`、`frontend/tsconfig.json`、`frontend/tsconfig.app.json` — 加 `@skillstack/ui` 别名
- `frontend/src/lib/tokens.ts`、`utils.ts`、`visualAssets.ts`、`components/icons.tsx`、`components/ui/index.ts` — 改 shim

修改（desktop）：
- `desktop/vite.config.ts`、`desktop/tsconfig.app.json`、`desktop/tsconfig.json` — 加别名
- `desktop/src/pages/*.tsx`、`desktop/src/App.tsx`、`desktop/src/main.tsx`
- 删除 `desktop/src/components/Button.tsx`、`desktop/src/pages/pageHeaderStyles.ts`

保留（app 专属，不进包）：
- `frontend/src/components/ui/AvatarUpload.tsx`、`IconUpload.tsx`、`frontend/src/components/atoms/PromptCard.tsx`（barrel 仍从本地再导出）
- `desktop/src/pages/transientScrollbar.ts`

---

## Phase 1 — 建包 + shim（不改任何观感）

> 验收硬指标：完成后 `cd frontend && npm run lint && npm run build` 照常绿，证明 shim 零改动成立。

### Task 1: 创建分支与根 workspaces

**Files:**
- Create: `package.json`（仓库根）

- [ ] **Step 1: 建分支**

```bash
cd /Users/yoqu/Documents/code/self/skill-team-share
git checkout -b feat/desktop-ui-alignment
```

- [ ] **Step 2: 写根 package.json**

Create `package.json`:

```json
{
  "name": "skillstack-monorepo",
  "private": true,
  "version": "0.0.0",
  "workspaces": [
    "frontend",
    "desktop",
    "packages/*"
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add root workspaces for shared ui package"
```

### Task 2: 脚手架 packages/ui（空壳可解析）

**Files:**
- Create: `packages/ui/package.json`、`packages/ui/tsconfig.json`、`packages/ui/src/index.ts`

- [ ] **Step 1: 写 packages/ui/package.json**

```json
{
  "name": "@skillstack/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./tokens": "./src/tokens.ts",
    "./icons": "./src/icons.tsx",
    "./utils": "./src/utils.ts",
    "./visualAssets": "./src/visualAssets.ts"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "@radix-ui/react-dropdown-menu": "^2.1.2"
  },
  "peerDependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.456.0"
  }
}
```

- [ ] **Step 2: 写 packages/ui/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": { "@skillstack/ui/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 写占位 barrel**

Create `packages/ui/src/index.ts`:

```ts
export {};
```

- [ ] **Step 4: 安装并校验 workspace 链接**

Run: `npm install`
Expected: 成功，`node_modules/@skillstack/ui` 软链到 `packages/ui`。

- [ ] **Step 5: Commit**

```bash
git add packages/ui package-lock.json
git commit -m "chore: scaffold @skillstack/ui package"
```

### Task 3: 移入基础模块（tokens / icons / utils / visualAssets）

**Files:**
- Create via move: `packages/ui/src/tokens.ts`、`icons.tsx`、`utils.ts`、`visualAssets.ts`

- [ ] **Step 1: git mv 四个文件**

```bash
git mv frontend/src/lib/tokens.ts        packages/ui/src/tokens.ts
git mv frontend/src/components/icons.tsx packages/ui/src/icons.tsx
git mv frontend/src/lib/utils.ts         packages/ui/src/utils.ts
git mv frontend/src/lib/visualAssets.ts  packages/ui/src/visualAssets.ts
```

说明：这四个文件无 `@/` 内部依赖（已勘探：tokens/visualAssets 自包含，icons 仅 react，utils 仅 clsx+tailwind-merge），移动后无需改内部 import。

- [ ] **Step 2: frontend 入口改 shim**

Create `frontend/src/lib/tokens.ts`:
```ts
export * from '@skillstack/ui/tokens';
```
Create `frontend/src/lib/utils.ts`:
```ts
export * from '@skillstack/ui/utils';
```
Create `frontend/src/lib/visualAssets.ts`:
```ts
export * from '@skillstack/ui/visualAssets';
```
Create `frontend/src/components/icons.tsx`:
```ts
export * from '@skillstack/ui/icons';
```

- [ ] **Step 3: frontend 加别名（vite + 两个 tsconfig）**

Modify `frontend/vite.config.ts` 的 `resolve.alias`，在 `'@'` 一行后加：
```ts
      '@skillstack/ui': path.resolve(__dirname, '../packages/ui/src'),
```
Modify `frontend/tsconfig.json` 和 `frontend/tsconfig.app.json` 的 `compilerOptions.paths`，加：
```json
      "@skillstack/ui": ["../packages/ui/src/index.ts"],
      "@skillstack/ui/*": ["../packages/ui/src/*"]
```
注意 `frontend/tsconfig.app.json` 的 `include` 改为 `["src", "../packages/ui/src"]`，让 tsc 纳入包源码。

- [ ] **Step 4: 验证 frontend 编译通过**

Run: `cd frontend && npm run lint`
Expected: PASS（tsc 无错误；tokens/icons/utils 的 143/87/众多调用点经 shim 解析成功）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(ui): move tokens/icons/utils/visualAssets into @skillstack/ui with frontend shims"
```

### Task 4: 解耦 SkillCard（去掉 @/mocks/skills 依赖）

**Files:**
- Modify: `frontend/src/components/ui/SkillCard.tsx`（移入前先解耦）

- [ ] **Step 1: 查清 SkillCard 用到的 mocks 类型**

Run: `grep -nE "mocks/skills|: Skill|Skill\b" frontend/src/components/ui/SkillCard.tsx`
Expected: 看到 `import type { Skill } from '@/mocks/skills'` 及其字段用法。

- [ ] **Step 2: 在 SkillCard 内联其所需 prop 形状，删除对 mocks 的 import**

把 `import type { Skill } from '@/mocks/skills'` 替换为组件本地定义（只保留卡片真正渲染用到的字段，按 Step 1 结果填全）：

```ts
export interface SkillCardData {
  id: string | number;
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  tags?: string[];
  // …按 Step 1 grep 出的实际字段补齐，类型与 mocks/skills 的 Skill 对应字段保持一致
}
```

并把组件里原本 `Skill` 的引用改为 `SkillCardData`。frontend 现有调用点传入的 mock `Skill` 结构上满足该接口，无需改调用点。

- [ ] **Step 3: 验证 frontend 仍编译**

Run: `cd frontend && npm run lint`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/SkillCard.tsx
git commit -m "refactor(ui): decouple SkillCard from @/mocks/skills via local prop type"
```

### Task 5: 移入 ui 原子组件 + 改 barrel

**Files:**
- Move: `frontend/src/components/ui/*.tsx`（除 `AvatarUpload`/`IconUpload`/`index.ts`/`*.test.tsx`）与 `frontend/src/components/atoms/TeamAvatar.tsx` → `packages/ui/src/components/`
- Create: `packages/ui/src/index.ts`（barrel）
- Modify: `frontend/src/components/ui/index.ts`（改 shim + 本地再导出）

- [ ] **Step 1: 移动组件文件**

```bash
mkdir -p packages/ui/src/components
# 移动除 AvatarUpload/IconUpload/index.ts/测试外的所有 ui 组件
for f in frontend/src/components/ui/*.tsx; do
  base=$(basename "$f")
  case "$base" in
    AvatarUpload.tsx|IconUpload.tsx|*.test.tsx) continue;;
    *) git mv "$f" "packages/ui/src/components/$base";;
  esac
done
git mv frontend/src/components/atoms/TeamAvatar.tsx packages/ui/src/components/TeamAvatar.tsx
```

- [ ] **Step 2: 改写移入文件的内部 import 为包内相对路径**

移入文件里现存的内部引用需改：`@/lib/tokens` → `../tokens`，`@/components/icons` → `../icons`，`@/lib/utils` → `../utils`，`@/lib/visualAssets` → `../visualAssets`，组件间相对引用（如 `./SkillIcon`）保持不变。

```bash
cd packages/ui/src/components
sed -i '' \
  -e "s#'@/lib/tokens'#'../tokens'#g" \
  -e "s#'@/components/icons'#'../icons'#g" \
  -e "s#'@/lib/utils'#'../utils'#g" \
  -e "s#'@/lib/visualAssets'#'../visualAssets'#g" \
  *.tsx
cd /Users/yoqu/Documents/code/self/skill-team-share
```

校验无残留：`grep -rn "@/" packages/ui/src/components` → 预期无输出（SkillCard 已在 Task 4 去掉 mocks 依赖）。若有残留（个别 app 耦合），将该组件移回 frontend 并从下面 barrel 的本地再导出段处理。

- [ ] **Step 3: 写包 barrel `packages/ui/src/index.ts`**

把原 `frontend/src/components/ui/index.ts` 的导出整体搬来，但路径改为 `./components/X`，并**移除** `AvatarUpload`、`IconUpload`、`PromptCard`（app 耦合，留在 frontend），`TeamAvatar` 改为 `./components/TeamAvatar`。完整内容：

```ts
export { Button } from './components/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button';
export { Badge } from './components/Badge';
export type { BadgeProps, BadgeTone, BadgeSize } from './components/Badge';
export { Card } from './components/Card';
export type { CardProps } from './components/Card';
export { Avatar } from './components/Avatar';
export type { AvatarProps } from './components/Avatar';
export { TeamAvatar } from './components/TeamAvatar';
export type { TeamAvatarProps } from './components/TeamAvatar';
export { OtpInput } from './components/OtpInput';
export type { OtpInputProps } from './components/OtpInput';
export { SectionHeader } from './components/SectionHeader';
export type { SectionHeaderProps } from './components/SectionHeader';
export { Divider } from './components/Divider';
export type { DividerProps } from './components/Divider';
export { Kbd } from './components/Kbd';
export { Stat } from './components/Stat';
export type { StatProps } from './components/Stat';
export { SkillCard } from './components/SkillCard';
export type { SkillCardProps, SkillCardData } from './components/SkillCard';
export { SkillIcon } from './components/SkillIcon';
export type { SkillIconProps } from './components/SkillIcon';
export { Input } from './components/Input';
export { Textarea } from './components/Textarea';
export { FormField } from './components/FormField';
export { FormError } from './components/FormError';
export { PrefixInput } from './components/PrefixInput';
export { PhoneInput } from './components/PhoneInput';
export { Select } from './components/Select';
export type { SelectOption } from './components/Select';
export { OptionCard } from './components/OptionCard';
export { OptionGroup } from './components/OptionGroup';
export { DashTopBar } from './components/DashTopBar';
export type { DashTopBarProps } from './components/DashTopBar';
export { EmptyState } from './components/EmptyState';
export type { EmptyStateProps } from './components/EmptyState';
export { ToastViewport, toast } from './components/Toast';
export type { ToastKind, ToastPayload } from './components/Toast';
export { CopyButton } from './components/CopyButton';
export type { CopyButtonProps } from './components/CopyButton';
export { TagsInput } from './components/TagsInput';
export type { TagsInputProps, TagsInputHandle } from './components/TagsInput';
export { IconButton } from './components/IconButton';
export type { IconButtonProps, IconButtonSize, IconButtonVariant } from './components/IconButton';
export { SegmentedControl } from './components/SegmentedControl';
export type { SegmentedControlProps, SegmentedOption } from './components/SegmentedControl';
export { Checkbox } from './components/Checkbox';
export type { CheckboxProps } from './components/Checkbox';
export {
  DataTable, DataTableBody, DataTableCell, DataTableEmpty,
  DataTableHead, DataTableHeader, DataTableRow,
} from './components/DataTable';
export type { DataTableCellProps, DataTableHeaderProps, DataTableProps } from './components/DataTable';
export { SearchInput } from './components/SearchInput';
export type { SearchInputProps } from './components/SearchInput';
export { Slider } from './components/Slider';
export type { SliderProps } from './components/Slider';
export { Pressable } from './components/Pressable';
export type { PressableProps } from './components/Pressable';
```

（注：`SkillCardProps` 若原文件未导出该名，则据实调整为实际导出的类型名；`SkillCardData` 来自 Task 4。）

- [ ] **Step 4: frontend barrel 改 shim + 本地再导出 app 耦合件**

Replace `frontend/src/components/ui/index.ts` 全文：

```ts
// 共享设计系统（唯一来源）
export * from '@skillstack/ui';

// app 耦合组件保留在 frontend
export { AvatarUpload } from './AvatarUpload';
export type { AvatarUploadProps } from './AvatarUpload';
export { IconUpload } from './IconUpload';
export type { IconUploadProps } from './IconUpload';
export { PromptCard } from '../atoms/PromptCard';
export type { PromptCardProps } from '../atoms/PromptCard';
```

修正 `AvatarUpload.tsx`/`IconUpload.tsx` 内部对 `@/lib/tokens` 等的引用——它们仍在 frontend，`@/` 别名照常可用（经 shim 指向包），无需改。

- [ ] **Step 5: 验证 frontend lint + build 全绿（Phase 1 验收）**

Run: `cd frontend && npm run lint && npm run build`
Expected: 均 PASS。这是 shim 零改动成立的硬证据。若报缺某导出，对照 Step 3 barrel 名称修正。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(ui): move atomic components into @skillstack/ui, keep frontend barrel via shim"
```

### Task 6: 桌面端接入别名（暂不换页面，先验证可消费）

**Files:**
- Modify: `desktop/vite.config.ts`、`desktop/tsconfig.app.json`、`desktop/tsconfig.json`

- [ ] **Step 1: desktop 加 vite 别名**

Modify `desktop/vite.config.ts` 的 `resolve.alias`，在 `'@'` 后加：
```ts
      '@skillstack/ui': path.resolve(__dirname, '../packages/ui/src'),
```

- [ ] **Step 2: desktop 加 tsconfig paths**

Modify `desktop/tsconfig.app.json` 与 `desktop/tsconfig.json` 的 `compilerOptions.paths` 加：
```json
      "@skillstack/ui": ["../packages/ui/src/index.ts"],
      "@skillstack/ui/*": ["../packages/ui/src/*"]
```
并把 `desktop/tsconfig.app.json` 的 `include` 改为 `["src", "../packages/ui/src"]`。
注意 desktop tsconfig `moduleResolution` 为 `Node`；若包内 `bundler` 风格子路径解析报错，将 desktop app tsconfig 的 `moduleResolution` 调整为 `Bundler` 并 `allowImportingTsExtensions: false`（与 frontend 对齐）。

- [ ] **Step 3: 冒烟一个引用**

在 `desktop/src/App.tsx` 顶部临时加 `import { Button } from '@skillstack/ui';` 并在某处使用，`npm run lint`（desktop）验证解析成功，然后撤掉临时引用。

Run: `cd desktop && npm run lint`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add desktop/vite.config.ts desktop/tsconfig.app.json desktop/tsconfig.json
git commit -m "chore(desktop): resolve @skillstack/ui via alias"
```

### Task 7: 新增载入态原子 Spinner / Skeleton（TDD）

**Files:**
- Create: `packages/ui/src/components/Spinner.tsx`、`Skeleton.tsx`、`Spinner.test.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: 写失败测试**

Create `packages/ui/src/components/Spinner.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { Spinner } from './Spinner';

test('Spinner renders with role status and accessible label', () => {
  const { getByRole } = render(<Spinner label="加载中" />);
  const el = getByRole('status');
  expect(el).toHaveAttribute('aria-label', '加载中');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run ../packages/ui/src/components/Spinner.test.tsx`
（注：测试经 frontend 的 vitest 环境跑，jsdom 已配置。）
Expected: FAIL（Spinner 未定义）。

- [ ] **Step 3: 实现 Spinner 与 Skeleton**

Create `packages/ui/src/components/Spinner.tsx`（内联 style + tokens，旋转用内联 keyframes 注入或 CSS `animation`，与项目内联风格一致）:
```tsx
import type { CSSProperties } from 'react';
import { TOKENS } from '../tokens';

export interface SpinnerProps { size?: number; label?: string; style?: CSSProperties; }

export function Spinner({ size = 18, label = '加载中', style }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: 'inline-block', width: size, height: size,
        border: `2px solid ${TOKENS.borderSoft}`, borderTopColor: TOKENS.primary,
        borderRadius: '50%', animation: 'sk-spin 0.6s linear infinite', ...style,
      }}
    />
  );
}
```
Create `packages/ui/src/components/Skeleton.tsx`:
```tsx
import type { CSSProperties } from 'react';
import { TOKENS } from '../tokens';

export interface SkeletonProps { width?: number | string; height?: number | string; radius?: number; style?: CSSProperties; }

export function Skeleton({ width = '100%', height = 14, radius = 6, style }: SkeletonProps) {
  return (
    <span style={{ display: 'block', width, height, borderRadius: radius,
      background: TOKENS.bgGray, animation: 'sk-pulse 1.2s ease-in-out infinite', ...style }} />
  );
}
```
keyframes `sk-spin`/`sk-pulse`：加到两端的全局 css —— `frontend/src/index.css` 与 `desktop/src/styles.css` 各加一次：
```css
@keyframes sk-spin { to { transform: rotate(360deg); } }
@keyframes sk-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
```

- [ ] **Step 4: 导出并跑测试通过**

在 `packages/ui/src/index.ts` 末尾加：
```ts
export { Spinner } from './components/Spinner';
export type { SpinnerProps } from './components/Spinner';
export { Skeleton } from './components/Skeleton';
export type { SkeletonProps } from './components/Skeleton';
```
Run: `cd frontend && npx vitest run ../packages/ui/src/components/Spinner.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): add shared Spinner/Skeleton loading atoms"
```

---

## Phase 2 — 桌面端逐页换血

> 每页一 Task：用共享原子替换手写内联，删 `Button.tsx`/`pageHeaderStyles.ts`。每页完成后跑 `cd desktop && npm run lint && npm test`，并 Electron 冒烟。保留 `transientScrollbar`。
>
> 通用替换约定（每页适用）：
> - `import { Button } from '../components/Button'` → `import { Button } from '@skillstack/ui'`（变体名 `secondary`/`primary` 兼容；其余用 `ghost`/`danger` 等）。
> - `pageTitleStyle`/`pageSubtitleStyle`（来自 `pageHeaderStyles`）→ 用 `<SectionHeader title=… subtitle=… />`。
> - 手写颜色 `#111827`/`#6b7280` → `TOKENS.text`/`TOKENS.text2`（`import { TOKENS } from '@skillstack/ui/tokens'`）。
> - 手写卡片/徽章/输入/搜索 → `Card`/`Badge`/`Input`/`SearchInput`。

### Task 8: DesktopLayout 换血 + 删 Button/pageHeaderStyles

**Files:**
- Modify: `desktop/src/pages/DesktopLayout.tsx`
- Delete: `desktop/src/components/Button.tsx`、`desktop/src/pages/pageHeaderStyles.ts`

- [ ] **Step 1: 全仓搜旧引用**

Run: `grep -rln "components/Button\|pageHeaderStyles" desktop/src`
记录所有引用文件（后续 Task 会逐一处理；本 Task 先处理 Layout 自身）。

- [ ] **Step 2: 改 DesktopLayout 用共享原子**

替换侧边导航项为 `Pressable`/`IconButton`（hover/focus/active 态），激活态色用 `TOKENS.primary`/`primarySoft`；页头若用到标题样式改 `SectionHeader`。`Button` 引用改 `@skillstack/ui`。

- [ ] **Step 3: 删两个自造件（确认无残留引用后）**

```bash
git rm desktop/src/components/Button.tsx desktop/src/pages/pageHeaderStyles.ts
```
若 `grep -rln "components/Button\|pageHeaderStyles" desktop/src` 仍有命中，先在对应页面（Task 9–12）改完再删；本 Task 删除步骤可推迟到 Task 12 之后，但务必在 Phase 2 结束前完成。

- [ ] **Step 4: 验证**

Run: `cd desktop && npm run lint && npm test`
Expected: PASS。Electron 冒烟：`npm run dev:electron`，确认布局、侧边导航激活态正常。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor(desktop): rebuild DesktopLayout with shared atoms"
```

### Task 9: PlazaPage 换血

**Files:**
- Modify: `desktop/src/pages/PlazaPage.tsx`（397 行）、对照 `desktop/src/pages/PlazaPage.test.tsx`

- [ ] **Step 1: 跑现有测试建基线**

Run: `cd desktop && npx vitest run src/pages/PlazaPage.test.tsx`
Expected: PASS（基线）。

- [ ] **Step 2: 替换为共享原子**

技能列表项改 `SkillCard`（传入符合 `SkillCardData` 的对象），搜索框改 `SearchInput`，页头改 `SectionHeader`，空/错态改 `EmptyState`，载入态改 `Skeleton`。Button 改 `@skillstack/ui`。保留分类筛选逻辑（参考 memory：广场分类前端筛选）。

- [ ] **Step 3: 跑测试 + 冒烟**

Run: `cd desktop && npx vitest run src/pages/PlazaPage.test.tsx && npm run lint`
Expected: PASS。若测试断言旧 DOM 结构，按新结构更新断言（保持行为语义不变）。Electron 冒烟广场页。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor(desktop): rebuild PlazaPage with shared SkillCard/SearchInput/EmptyState"
```

### Task 10: MySkillsPage 换血（882 行，最大）

**Files:**
- Modify: `desktop/src/pages/MySkillsPage.tsx`、对照 `mySkillsGroups.test.ts`

- [ ] **Step 1: 跑现有测试基线**

Run: `cd desktop && npx vitest run src/pages/mySkillsGroups.test.ts`
Expected: PASS。

- [ ] **Step 2: 分块替换**

这页大，按区块分多次编辑：分组头用 `SectionHeader`，技能卡用 `SkillCard`，状态徽章用 `Badge`，操作按钮用 `Button`/`IconButton`，空态用 `EmptyState`，载入用 `Skeleton`，复制路径等用 `CopyButton`。纯数据逻辑（`mySkillsGroups.ts`/`importPersonalSkill.ts`）不动。

- [ ] **Step 3: 验证**

Run: `cd desktop && npm run lint && npm test`
Expected: PASS。Electron 冒烟「我的技能」页：列表渲染、导入入口、删除/复制按钮不报错。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor(desktop): rebuild MySkillsPage with shared atoms"
```

### Task 11: RecommendationsPage 换血

**Files:**
- Modify: `desktop/src/pages/RecommendationsPage.tsx`（409 行）、对照 `recommendations.test.ts`

- [ ] **Step 1: 基线测试**

Run: `cd desktop && npx vitest run src/pages/recommendations.test.ts`
Expected: PASS。

- [ ] **Step 2: 替换原子**

推荐卡片改 `SkillCard`/`Card`，页头 `SectionHeader`，空/载态 `EmptyState`/`Skeleton`，按钮 `Button`。推荐算法逻辑（`recommendations.ts`）不动。

- [ ] **Step 3: 验证 + Commit**

```bash
cd desktop && npm run lint && npm test
```
Expected: PASS。
```bash
git add -A && git commit -m "refactor(desktop): rebuild RecommendationsPage with shared atoms"
```

### Task 12: DesktopSettingsPage + DesktopLogin 换血（表单为主）

**Files:**
- Modify: `desktop/src/pages/DesktopSettingsPage.tsx`（371 行）、`desktop/src/pages/DesktopLogin.tsx`（233 行）

- [ ] **Step 1: 设置页改表单原子**

字段改 `FormField`+`Input`，开关用 `Checkbox`/`SegmentedControl`，分组头 `SectionHeader`，保存按钮 `Button`（带 loading 态），保存反馈用 `toast`（需在 `App.tsx` 挂 `ToastViewport`，见 Task 13）。

- [ ] **Step 2: 登录页改表单原子**

账号/密码改 `FormField`+`Input`，验证码改 `OtpInput`，手机号改 `PhoneInput`，错误改 `FormError`，提交按钮 `Button` loading 态，键盘可达（Enter 提交、focus 顺序）。

- [ ] **Step 3: 确认旧自造件已无引用并删除**

Run: `grep -rln "components/Button\|pageHeaderStyles" desktop/src`
Expected: 无输出。若 Task 8 尚未删除，此时执行 `git rm`。

- [ ] **Step 4: 验证**

Run: `cd desktop && npm run lint && npm test`
Expected: PASS。Electron 冒烟登录与设置：表单校验、错误提示、提交反馈正常。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor(desktop): rebuild Settings/Login forms with shared form atoms"
```

---

## Phase 3 — 交互四维打磨

### Task 13: 全局反馈（Toast）+ 冷启动白屏修复

**Files:**
- Modify: `desktop/src/App.tsx`、`desktop/src/main.tsx`

- [ ] **Step 1: 挂载 ToastViewport**

在 `desktop/src/App.tsx` 的 `QueryClientProvider` 内、`RouterProvider` 旁渲染 `<ToastViewport />`（`import { ToastViewport } from '@skillstack/ui'`），使各页 `toast(...)` 生效。

- [ ] **Step 2: 修冷启动白屏（react-query 配置）**

把 `App.tsx` 的 `defaultOptions.queries.refetchOnMount` 由 `'always'` 改为 `true`（默认，stale 才取），并确保各页有 `isLoading` 时渲染 `Skeleton` 而非空白。保留 `staleTime: 10_000`。

- [ ] **Step 3: 验证**

Run: `cd desktop && npm run lint && npm test`
Expected: PASS。Electron 冒烟：页面切换不再整屏白闪，载入时显示骨架。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(desktop): global toast viewport + fix cold-start blank via skeleton"
```

### Task 14: 状态一致性扫尾 + 微动效统一

**Files:**
- Modify: 任何仍有 ad-hoc 空/错/载态或裸 `<button>`/`<div onClick>` 的 desktop 页面

- [ ] **Step 1: 扫描遗留**

Run: `grep -rnE "onClick=\{|加载中|出错|暂无|空" desktop/src/pages/*.tsx | grep -vE "Pressable|Button|EmptyState|Spinner|Skeleton|toast"`
逐条评估：交互元素是否应改 `Pressable`/`IconButton`（统一 hover/focus/pressed），空/错文案是否应改 `EmptyState`。

- [ ] **Step 2: 统一替换**

裸点击元素改 `Pressable`/`IconButton`；剩余 ad-hoc 空/错态改 `EmptyState`；列表/卡片载入统一 `Skeleton`。

- [ ] **Step 3: 验证**

Run: `cd desktop && npm run lint && npm test`
Expected: PASS。Electron 冒烟各页 hover/focus 反馈一致。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "polish(desktop): unify interaction states and micro-feedback"
```

### Task 15: 全量回归与收尾

- [ ] **Step 1: 两端全量校验**

```bash
cd frontend && npm run lint && npm run build
cd ../desktop && npm run lint && npm test && npm run build
```
Expected: 全 PASS。frontend build 绿再次确认 shim 无回归。

- [ ] **Step 2: 桌面端打包冒烟（可选但建议）**

Run: `cd desktop && npm run pack`
Expected: electron-builder `--dir` 成功，产物可启动（确认 Vite 别名在生产构建中解析正常）。

- [ ] **Step 3: 更新 AGENT.md 目录说明**

在 `AGENT.md` 的「主要目录」补一条 `packages/ui/`：共享设计系统（tokens + ui 原子 + icons），frontend 与 desktop 共用，源码直连消费。

- [ ] **Step 4: Commit**

```bash
git add AGENT.md && git commit -m "docs(agent): document packages/ui shared design system"
```

---

## Self-Review（plan vs spec）

- **Spec §3.1 共享包/源码直连** → Task 2/3/6（别名、exports、workspaces）。✓
- **Spec §3.2 包内容 + 排除 AvatarUpload/IconUpload** → Task 5 Step 1/4。✓
- **Spec §3.2 新增 Spinner/Skeleton** → Task 7。✓
- **Spec §3.3 Web 零改动 shim** → Task 3 Step 2、Task 5 Step 4，验收门 Task 5 Step 5。✓
- **Spec §3.2 SkillCard 解耦** → Task 4。✓
- **Spec §4 换血映射（含删 Button/pageHeaderStyles、保留 transientScrollbar）** → Task 8–12。✓
- **Spec §5.1 状态一致性** → Task 9–12 各页 EmptyState/Skeleton + Task 14。✓
- **Spec §5.2 微动效** → Task 8（Pressable 导航）+ Task 14。✓
- **Spec §5.3 导航/IA + 冷启动白屏** → Task 8 + Task 13 Step 2。✓
- **Spec §5.4 表单输入** → Task 12。✓
- **Spec §7 验证（frontend 绿、desktop lint/test/build、Electron 冒烟）** → 各 Task 验证步 + Task 15。✓
- **Spec §8 风险（Preflight/reset、依赖拉入、Electron 打包别名）** → Task 6 Step 2 note、Task 15 Step 2。✓

类型一致性：`SkillCardData`（Task 4 定义，Task 5/9/10/11 使用）、barrel 导出名（Task 5 Step 3 与 frontend shim Task 5 Step 4 一致）、Spinner/Skeleton 签名（Task 7 定义，Task 9–14 使用）一致。无占位符。
