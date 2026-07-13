# UI 基础组件系统设计

**日期**: 2026-05-20  
**状态**: 已批准，待实施

## 背景

前端现有代码中，表单输入框、标签+错误展示、手机号格式化、带前缀输入、单选卡片等模式在多处重复实现。同时存在两套功能相同的 FormField 组件（`create/_shared.tsx` 和 `auth/Register/RegField.tsx`），以及 Login/Register 两处手机号输入框实现细节存在大量差异。

本次目标：建立统一的 `src/components/ui/` 组件库，消灭所有重复，一次性全量替换。

---

## 现有代码差异分析（需统一的分歧点）

### PhoneInput — Login vs Register 差异

| 细节 | `auth/Login.tsx` LoginPhone | `auth/Register/Step1.tsx` | 统一决策 |
|------|-----------------------------|---------------------------|---------|
| 边框 | `1.5px solid` | `1px solid` | `1px solid`（state 变色但不变粗） |
| border-radius | `10` | `8` | **`8`** |
| 前缀内容 | 🇨🇳 emoji + "+86" | 仅 "+86" | **仅 "+86"**（简洁） |
| 输入 padding | `12px 14px` | `11px 12px` | **`10px 12px`** |
| 输入 fontSize | `15` | `14` | **`14`** |
| 字体 | 等宽 monospace | 默认字体 | **等宽**（手机号场景合理） |
| 验证逻辑 | `^1[3-9]\d{9}$` 正则 | 仅 `.length === 11` | **正则**（更严格） |
| 成功状态 | 绿框 + 右侧绿色勾号 | 无 | **有**（统一体验） |
| 错误展示 | 有内部 `touched` 状态 | 无 | **外部传 `error` prop**（父组件控制，PhoneInput 自身无 touched） |
| Aria 属性 | `aria-invalid` + `aria-describedby` | 无 | **有**（统一） |
| placeholder | "请输入 11 位手机号" | "138 0000 0000" | **"138 0000 0000"**（示例更直观） |

### FormField — `create/_shared` vs `auth/Register/RegField` 差异

| 细节 | `create/_shared FormField` | `auth/Register/RegField` | 统一决策 |
|------|---------------------------|--------------------------|---------|
| label HTML 元素 | `<div>`（语义错误） | `<label>`（正确） | **`<label>`** |
| error prop | 无 | 有 | **有** |
| 容器 marginBottom | 强制 `14px` | 无 | **无**（由父级 gap 控制） |
| hint/error lineHeight | 无 | `1.5` | **`1.5`** |
| hint margin | `marginTop: 4` | `marginTop: 5` | **`marginTop: 4`** |

### inputStyle — 三处不同数值

| 来源 | padding | fontSize | borderRadius |
|------|---------|----------|-------------|
| `create/_shared.tsx` inputStyle | `9px 12px` | `13` | `8` |
| `auth/Login.tsx` 内联 | `12px 14px` | `15` | `10` |
| `auth/Register/Step3.tsx` 内联 | `11px 12px` | `14` | `8` |
| **统一决策** | **`10px 12px`** | **`14`** | **`8`** |

### 其他发现

- `create/_shared.tsx` 中混有 `DashTopBar` 布局组件，应移至 `components/ui/DashTopBar.tsx`
- `create/_shared.tsx` 的 `mockSubmit` 工具函数与 UI 无关，移至 `src/lib/utils.ts`

---

## 目录结构

```
src/components/
├── ui/                        ← 统一组件出口
│   ├── index.ts               ← barrel export（所有组件从此导入）
│   │
│   ├── # 迁入自 atoms/（文件原样移动，无内容改动）
│   ├── Button.tsx
│   ├── Badge.tsx
│   ├── Card.tsx
│   ├── Avatar.tsx
│   ├── OtpInput.tsx
│   ├── SectionHeader.tsx
│   ├── Divider.tsx
│   ├── Kbd.tsx
│   ├── Stat.tsx
│   ├── SkillCard.tsx
│   ├── SkillIcon.tsx
│   │
│   ├── # 从 create/_shared.tsx 迁出
│   ├── DashTopBar.tsx         ← 原 create/_shared.tsx 中的 DashTopBar
│   │
│   ├── # 新增表单组件
│   ├── Input.tsx
│   ├── Textarea.tsx
│   ├── PrefixInput.tsx
│   ├── PhoneInput.tsx
│   ├── FormField.tsx
│   ├── FormError.tsx
│   ├── OptionCard.tsx
│   └── OptionGroup.tsx
│
└── atoms/                     ← 保留作 re-export 过渡层，稳定后删除
    └── index.ts               ← export * from '../ui'
```

**使用规范**：业务代码统一从 `@/components/ui` 导入，禁止从具体文件路径导入。

---

## 统一样式基准

所有表单组件共用以下基准值，不允许各自偏离：

```
输入框基准：
  padding: '10px 12px'
  fontSize: 14
  border: '1px solid TOKENS.border'
  borderRadius: 8
  outline: 'none'
  background: '#fff'
  width: '100%'
  boxSizing: 'border-box'
  fontFamily: 'inherit'

state 控制边框色（Input / Textarea / PrefixInput）：
  default → border: '1px solid TOKENS.border'
  success → border: '1px solid TOKENS.success'
  error   → border: '1px solid TOKENS.danger'

标签基准：
  fontSize: 12
  fontWeight: 500
  color: TOKENS.text2
  display: 'block'
  marginBottom: 6

提示/错误基准：
  fontSize: 11.5
  marginTop: 4
  lineHeight: 1.5
  error → color: TOKENS.danger
  hint  → color: TOKENS.text3
```

---

## 新增组件规格

### `Input` — 基础文本输入框

```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  state?: 'default' | 'success' | 'error'
}
```

- `state` 控制边框色，见统一样式基准
- 其余所有 props 透传给原生 `<input>`
- 内部无逻辑，纯样式组件

---

### `Textarea` — 多行文本输入

```tsx
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  state?: 'default' | 'success' | 'error'
}
```

- 与 `Input` 接口完全对称
- `resize: 'vertical'`，`minHeight: 64`

---

### `FormField` — 字段标签+内容+提示包裹

```tsx
interface FormFieldProps {
  label: ReactNode
  required?: boolean      // 显示红色 * 标记
  hint?: ReactNode        // 灰色提示（优先级低于 error）
  error?: ReactNode       // 红色错误，有值时隐藏 hint
  children: ReactNode
}
```

- 用 `<label>` 包裹整体，语义正确
- 容器无 `marginBottom`，间距由父级 `gap` 控制
- 结构：`<label>标签文字</label> → children → FormError`
- `required` 时 label 后追加 `<span style={{ color: TOKENS.danger }}>*</span>`
- 替代：`create/_shared.tsx::FormField` + `auth/Register/RegField.tsx::RegField`，两者均废弃

---

### `FormError` — 独立错误/提示文字

```tsx
interface FormErrorProps {
  message?: ReactNode
  type?: 'error' | 'hint'   // default: 'error'
}
```

- `message` 为空/undefined 时返回 null，不渲染任何 DOM
- `FormField` 内部使用，也可独立用于表单底部汇总错误

---

### `PrefixInput` — 带前缀输入框

```tsx
interface PrefixInputProps {
  prefix: ReactNode
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  state?: 'default' | 'success' | 'error'
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
}
```

- 整体外层 div 的 border 随 state 变色（不是内部 input 的 border）
- 前缀区域：`padding: '0 10px'`，`background: TOKENS.bgGray`，`borderRight: '1px solid TOKENS.border'`，`fontSize: 13`，`color: TOKENS.text2`，垂直居中
- 内部 input 无单独 border（由外层统一控制）
- 用于：`@`（handle）、`team/slug/`（suite slug）等
- `PhoneInput` 基于本组件实现

---

### `PhoneInput` — 手机号输入

```tsx
interface PhoneInputProps {
  value: string                        // 11位纯数字（无空格）
  onChange: (raw: string) => void      // 回调返回纯数字，无格式化
  error?: string                       // 父组件控制的错误信息
  state?: 'default' | 'success' | 'error'
}
```

**内部实现细节（统一 Login + Register 的最佳实践）：**
- 前缀：`"+86"`（纯文本，不含 emoji）
- 输入格式化：显示 `XXX XXXX XXXX`，onChange 回调前 `.replace(/\s/g, '')` 去空格
- 仅允许数字输入，最大 11 位
- 输入框字体：`fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace'`，`letterSpacing: 0.4`
- `state === 'success'` 时右侧显示绿色勾号（`I.check`）
- 无内部 `touched` 状态，error/state 完全由父组件决定
- Accessibility：`inputMode="numeric"`，`autoComplete="tel-national"`，`aria-invalid` 随 state=error 设置
- placeholder：`"138 0000 0000"`
- 替代：`Login.tsx::LoginPhone`（删除该子组件）、`Register/Step1.tsx` 的内联手机输入块

---

### `OptionCard` — 单选卡片

```tsx
interface OptionCardProps {
  value: string
  checked: boolean
  onChange: (value: string) => void
  title: string
  description?: string
  icon?: ReactNode
  disabled?: boolean
}
```

- 选中态：`border: 2px solid TOKENS.primary`，`background: TOKENS.primarySoft`，`borderRadius: 8`
- 未选中态：`border: 1px solid TOKENS.border`，`background: '#fff'`，`borderRadius: 8`
- 布局：左侧圆形单选指示器 + 右侧 title（`fontSize: 14, fontWeight: 500`）+ description（`fontSize: 12, color: TOKENS.text3`）
- 替代：`Register/Step1.tsx` 团队选择内联卡片、`MemberEditPane.tsx` 角色选择内联卡片

---

### `OptionGroup` — OptionCard 容器

```tsx
interface OptionGroupProps {
  children: ReactNode
  direction?: 'vertical' | 'horizontal'   // default: 'vertical'
}
```

- vertical：`display: flex`，`flexDirection: 'column'`，`gap: 8`
- horizontal：`display: flex`，`flexDirection: 'row'`，`flexWrap: 'wrap'`，`gap: 8`

---

### `DashTopBar` — 工作区页头（从 create/_shared.tsx 迁出）

接口不变，物理移动到 `components/ui/DashTopBar.tsx`，从 `@/components/ui` 导入。

---

## 迁移范围（全量替换）

### 废弃/清理文件

| 文件 | 操作 |
|------|------|
| `src/pages/auth/Register/RegField.tsx` | 整个文件删除 |
| `src/pages/create/_shared.tsx` | 删除 `FormField`、`inputStyle`、`DashTopBar` 定义；保留 `mockSubmit` 并移入 `src/lib/utils.ts` |
| `src/pages/auth/Login.tsx` 中的 `LoginPhone` 子组件 | 删除，改用 `<PhoneInput />` |

### atoms 目录

- `src/components/atoms/*.tsx` — 所有文件**物理移动**到 `src/components/ui/`（内容不改）
- `src/components/atoms/index.ts` — 改为 `export * from '../ui'`（过渡兼容层，后续迭代删除）

### 替换清单

| 新组件 | 替换位置 |
|--------|---------|
| `PhoneInput` | `auth/Login.tsx`（删 LoginPhone 子组件，改用 PhoneInput）、`auth/Register/Step1.tsx` |
| `PrefixInput` | `auth/Register/Step3.tsx`（handle @）、`create/CreateSkill/Step3.tsx`（slug）、`create/CreateSuite/Meta.tsx`（slug）、`team/admin/Settings/SettingsProfile.tsx`（slug） |
| `FormField` | `auth/Register/Step1~3.tsx`、`create/CreateSkill/Step3.tsx`、`create/CreateSuite/Meta.tsx`、`team/admin/Settings/SettingsProfile.tsx`、`team/admin/Members/MemberEditPane.tsx` 等所有 FormField/RegField 引用处 |
| `Input` | 所有 form 内裸 `<input type="text/password/email">` |
| `Textarea` | `create/CreateSuite/Meta.tsx`、`team/admin/Settings/SettingsProfile.tsx`、`team/member/MySubmissions/CommentsModal.tsx` |
| `OptionCard/Group` | `auth/Register/Step1.tsx`（团队选择）、`team/admin/Members/MemberEditPane.tsx`（角色选择） |
| `DashTopBar` | `pages/team/member/_shared/DashTopBar.tsx`、`pages/team/admin/_shared/DashTopBar.tsx`、所有引用 `create/_shared` DashTopBar 的地方 |

### imports 全量变更

```
from '@/components/atoms/Xxx'      →  from '@/components/ui'
from '@/components/atoms'          →  from '@/components/ui'
from '../_shared' (FormField)      →  from '@/components/ui'
from './RegField'                  →  from '@/components/ui'
```

---

## 不在本次范围内

- Modal/Dialog 通用组件（目前仅 1 个 CommentsModal，不急于抽象）
- Select/Dropdown 组件（无标准化需求）
- 表单状态管理库（不引入新依赖）
- CSS Modules / Tailwind 迁移（保持 inline styles + TOKENS）
- `mockSubmit` 的功能改动（仅物理迁移到 `src/lib/utils.ts`）
