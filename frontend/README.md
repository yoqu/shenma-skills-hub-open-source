# SkillStack Frontend

团队 Skill 平台前端。Vite + React 18 + TypeScript + Tailwind + React Router + TanStack Query。

## 启动

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
```

Dev server 把 `/api/*` 代理到 `http://localhost:8080`(后端)。

## 关键技术约定

- **设计 token 单一源**:`src/lib/tokens.ts` 导出 `TOKENS / CATEGORIES`,所有原子组件优先读这里,**不**从 `tokens.css` 直接取色。Tailwind 配置(`tailwind.config.ts`)同步映射这些值,便于在新的 shadcn 组件里用 `bg-brand` / `text-ink-2` 等工具类。
- **像素级 1:1 还原**:atom 与 chrome 组件直接用 inline `style` 复刻 `docs/design-ui/comp-*.jsx` 的尺寸/颜色,**不要硬塞进 shadcn API**。
- **shadcn 何时用**:仅在需要复杂行为(Dialog / Popover / Command / Tooltip)时,在 `src/components/ui/` 安装对应组件;UI 由 atom 决定,shadcn 只提供行为骨架。
- **icons**:首选 `@/components/icons` 里 `I.*`(1:1 from `icons.jsx`)。设计稿没有的图标,用 `lucide-react` fallback。

## 目录约定(给后续 5 个并行 FE agent)

```
src/
├── api/              ← 联调用 axios client、endpoint 集合 (FE-* agent 在自己页面里按需新建)
├── components/
│   ├── atoms/        ← 已就绪:Avatar / Badge / Button / Card / Divider / SkillIcon / SkillCard / Kbd / Stat / SectionHeader
│   ├── chrome/       ← 已就绪:TopBar / TeamSidebar / Tabs
│   ├── icons.tsx     ← 已就绪:50+ inline SVG (`I.search` 等)
│   └── ui/           ← shadcn 安装目录,按需新增
├── hooks/            ← 跨页面 hook 放这里(预留)
├── lib/
│   ├── tokens.ts     ← TOKENS / CATEGORIES
│   └── utils.ts      ← cn / hashColor / fmt
├── mocks/            ← 已就绪:team / skills / reviews / invites / suites / activity (含 TS 类型)
├── pages/
│   ├── public/       ← FE-Public:Home / Plaza / SkillDetail / TeamPublic / UserProfile
│   ├── auth/         ← FE-Auth:Login / Register
│   ├── team/
│   │   ├── admin/    ← FE-Admin:7 屏 (Dashboard / Skills / Reviews / Members / Invites / Suites / Settings)
│   │   └── member/   ← FE-Member:6 屏 (Dashboard / Skills / MySubmissions / Members / Suites / Prefs)
│   ├── create/       ← FE-Create:CreateSkill 4-step 向导 / CreateSuite
│   └── Placeholder.tsx  ← Phase 0b 占位组件,被替换前各路由都用它
├── App.tsx
├── main.tsx
├── index.css         ← Tailwind 三大指令 + CSS 变量
└── router.tsx        ← 22 屏路由清单
```

### Agent 工作纪律

1. 各 FE agent 只在自己的 `pages/<owner>/` 目录新增文件,**不要**改公共目录 `components/atoms/`、`components/chrome/`、`lib/`、`mocks/`(若必须改,先在 plan 中提)。
2. 路由实装时把 `router.tsx` 里对应路径的 `<Placeholder ...>` 替换成真实组件 import。
3. mock 数据从 `@/mocks` 取,**不要复制粘贴**到组件里。
4. 颜色一律走 `TOKENS` 或 Tailwind 颜色(`bg-brand`, `text-ink-2`, ...),禁止硬编码 hex(临时调试除外)。

## 22 屏路由表

| 路由 | 屏号 | 屏名 | 负责 agent |
| --- | --- | --- | --- |
| `/` | 01 | Home | FE-Public |
| `/plaza` | 02 | Plaza | FE-Public |
| `/skills/:slug` | 03 | SkillDetail | FE-Public |
| `/teams/:slug` | 04 | TeamPublic | FE-Public |
| `/u/:handle` | 05 | UserProfile | FE-Public |
| `/login` | 06 | Login | FE-Auth |
| `/register` | 07 | Register | FE-Auth |
| `/team` | 08 / 15 | TeamDashboard(按角色切换) | FE-Admin / FE-Member |
| `/team/skills` | 09 / 16 | TeamSkills | FE-Admin / FE-Member |
| `/team/reviews` | 10 | TeamReviews | FE-Admin |
| `/team/mine` | 17 | MySubmissions | FE-Member |
| `/team/members` | 11 / 18 | TeamMembers | FE-Admin / FE-Member |
| `/team/invites` | 12 | TeamInvites | FE-Admin |
| `/team/suites` | 13 / 19 | TeamSuites | FE-Admin / FE-Member |
| `/team/settings` | 14 | TeamSettings | FE-Admin |
| `/team/prefs` | 20 | TeamPrefs | FE-Member |
| `/create/skill` | 21 | CreateSkill | FE-Create |
| `/create/suite` | 22 | CreateSuite | FE-Create |
