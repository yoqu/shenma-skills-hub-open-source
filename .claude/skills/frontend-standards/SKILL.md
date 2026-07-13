---
name: frontend-standards
description: Use when 编写、修改、审查或提交本仓库前端代码（frontend/ 下的 React + Vite + TypeScript + Tailwind），涉及 UI/样式、Button 等设计系统组件、Tailwind class/行内 style、API 数据访问、TanStack Query、路由页面、mock 数据时。仅在写代码/代码审查/提交代码场景触发。skill-team-share 专属约定。
---

# 前端标准规范

约束本仓库 `frontend/`（Vite + React 18 + TS + Tailwind + React Router + TanStack Query + Zustand + Radix/shadcn）的编码规范。写代码、审查、提交前对照执行。

## UI 与样式

- 设计 token 单一来源是 `frontend/src/lib/tokens.ts`。
- 新增颜色优先使用 `TOKENS` 或 Tailwind 语义色，不要随意硬编码 hex。
- 现有 atom 组件在 `frontend/src/components/atoms/`，优先复用。
- 复杂交互可使用 `frontend/src/components/ui/` 下的 Radix / shadcn 行为骨架。
- 图标优先使用 `frontend/src/components/icons.tsx` 中已有的 `I.*`，没有再用 `lucide-react`。
- 页面应服务高频工作台场景，信息密度要适中，避免营销式 hero 和装饰性卡片堆叠。

### 行内样式 vs CSS class：Tailwind Preflight 铁律

- 本项目用经典（未分层）Tailwind Preflight（`frontend/src/index.css` 的 `@tailwind base`）。它带着未分层 author 规则，如 `*{border-width:0;border-style:solid}`、`button{background-color:transparent}`。
- CSS 级联里**未分层 author 规则会盖过任何 `@layer`**。所以「把组件外观放进 CSS class / `@layer`，再想被调用方 class 覆盖」这条路在本项目走不通：要么压不过 Preflight（边框/背景被复位掉），要么压过了 Preflight 又压过调用方 class，特异性上无解。
- 因此设计系统组件（如 `frontend/src/components/ui/Button.tsx`）的外观**刻意用行内 `style` 落地**——只有行内样式能稳定压过未分层 Preflight。**不要把 `Button` 这类组件的外观改成 CSS class 或注入式 `@layer`**，会导致全站按钮边框/背景丢失（典型现象：primary 按钮白字配透明底，看着像"字和边框都没了"）。
- 需要逐实例改外观：传 `style`（行内、最高优先级）。`className` 仅用于挂工具类/标记类，**无法覆盖组件的行内外观**。需要完全自定义外观的一次性按钮（如第三方登录按钮），直接用原生 `<button className="...">` 自己写样式，别套 `Button`。
- 真要支持「className 主题化覆盖」，得先把 Tailwind 三段显式放进原生 `@layer` + 设计系统整体从行内迁到 class，属全站级重构，需单独立项评估，不在常规改动范围内。

## 数据访问

- API endpoint 统一从 `frontend/src/api/` 维护。
- 远端状态优先使用 TanStack Query。
- 不要把 mock 数据复制粘贴到页面组件中；如仍需 mock，优先从 `frontend/src/mocks/` 读取。
- 已经接真实 API 的页面不要回退到静态 mock，除非任务明确要求临时降级。
- 头像 / Logo 等「DB storage key → 对外完整 URL」字段，前端 Avatar / Logo 组件必须同时收 `char`（字符兜底）和 `url`（图片 URL），把后端 `avatarUrl` / `logoUrl` 透传给 `url`，不要只传 `char`。完整链路见 backend-standards 的「存储 URL 铁律」。

## 路由与页面

- 公共页面在 `frontend/src/pages/public/`。
- 登录注册在 `frontend/src/pages/auth/`。
- 团队管理与成员工作区在 `frontend/src/pages/team/`。
- 创建流程在 `frontend/src/pages/create/`。
- 当前用户私有账号页在 `frontend/src/pages/account/`。

修改路由时，优先检查 `frontend/src/router.tsx`、`frontend/src/components/chrome/TopBar.tsx` 和相关导航入口是否一致。

## 前端命令

```bash
cd frontend
npm install
npm run dev
npm run lint
npm run build
```

- `npm run dev` 启动前端，默认端口 `5173`。
- `npm run lint` 当前实际是 `tsc -b --noEmit` 类型检查。
- `npm run build` 执行 `tsc -b && vite build`。
- Vite dev server 会把 `/api/*` 代理到 `http://localhost:8080`。
