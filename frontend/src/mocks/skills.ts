export type Visibility = 'PUBLIC' | 'TEAM_PRIVATE';
export type SkillStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'UNLISTED';
export type SafetyLevel = 'pass' | 'warn' | 'fail';

export interface SkillAuthor {
  id?: number;
  name: string;
  handle: string;
}

export interface Skill {
  /** 后端 skills.id；从真实 API 拉取的对象一定带，前端 mock 数据可能省略。 */
  id?: number;
  slug: string;
  name: string;
  short: string;
  cat: string;
  icon: string;
  /** 自定义上传图标完整 URL（无则前端回退到分类图 / 字母） */
  iconUrl?: string;
  installs: number;
  stars: number;
  score: number;
  version: string;
  updated: string;
  visibility: Visibility;
  status: SkillStatus;
  author: SkillAuthor;
  team: string;
  tags: string[];
  safety: SafetyLevel;
  evalScore: number;
  langs: string[];
  filesCount?: number;
  license?: string;
  readme?: string;
  /** 长篇 Markdown 介绍（可含图片），详情页展示 */
  descriptionMd?: string;
}

export const SKILLS: Skill[] = [
  {
    slug: 'mono-format',
    name: 'Skill A · mono-format',
    short: '统一的多语言代码格式化命令,封装 prettier / black / gofmt。',
    cat: 'dev', icon: 'A',
    installs: 12480, stars: 824, score: 4.8, version: '2.4.1',
    updated: '2026-05-12', visibility: 'PUBLIC', status: 'APPROVED',
    author: { name: '林子睿', handle: 'lin_zr' }, team: 'ludou-fe',
    tags: ['CLI', 'formatter', 'monorepo'],
    safety: 'pass', evalScore: 92, langs: ['TS', 'Py', 'Go'],
  },
  {
    slug: 'api-mock',
    name: 'Skill B · api-mock',
    short: '基于 OpenAPI 文档的本地 Mock 服务,零配置启动。',
    cat: 'dev', icon: 'B',
    installs: 9820, stars: 612, score: 4.7, version: '1.8.3',
    updated: '2026-05-09', visibility: 'PUBLIC', status: 'APPROVED',
    author: { name: '赵一辰', handle: 'zhao_yc' }, team: 'ludou-fe',
    tags: ['mock', 'OpenAPI'], safety: 'pass', evalScore: 88, langs: ['TS'],
  },
  {
    slug: 'sql-tidy',
    name: 'Skill C · sql-tidy',
    short: '高性能 SQL 美化与重写,支持 MySQL / Postgres 方言。',
    cat: 'data', icon: 'C',
    installs: 7640, stars: 458, score: 4.6, version: '0.9.2',
    updated: '2026-05-04', visibility: 'PUBLIC', status: 'APPROVED',
    author: { name: '吴嘉禾', handle: 'wu_jh' }, team: 'ludou-fe',
    tags: ['SQL', 'lint'], safety: 'pass', evalScore: 85, langs: ['SQL'],
  },
  {
    slug: 'env-doctor',
    name: 'Skill D · env-doctor',
    short: '一键诊断本地开发环境,覆盖 Node / Python / Java / Docker。',
    cat: 'devops', icon: 'D',
    installs: 6210, stars: 391, score: 4.5, version: '1.2.0',
    updated: '2026-04-28', visibility: 'PUBLIC', status: 'APPROVED',
    author: { name: '陈奕笑', handle: 'chen_yx' }, team: 'ludou-fe',
    tags: ['CLI', 'diagnostic'], safety: 'pass', evalScore: 80, langs: ['Sh'],
  },
  {
    slug: 'i18n-extract',
    name: 'Skill E · i18n-extract',
    short: '从 React / Vue 源码自动提取文案并生成 i18n 资源文件。',
    cat: 'dev', icon: 'E',
    installs: 5180, stars: 304, score: 4.4, version: '3.0.0',
    updated: '2026-04-22', visibility: 'PUBLIC', status: 'APPROVED',
    author: { name: '林子睿', handle: 'lin_zr' }, team: 'ludou-fe',
    tags: ['i18n', 'AST'], safety: 'pass', evalScore: 78, langs: ['TS'],
  },
  {
    slug: 'doc-gen',
    name: 'Skill F · doc-gen',
    short: '根据接口注释生成 Markdown 文档站点。',
    cat: 'doc', icon: 'F',
    installs: 4720, stars: 268, score: 4.3, version: '2.1.0',
    updated: '2026-04-18', visibility: 'PUBLIC', status: 'APPROVED',
    author: { name: '赵一辰', handle: 'zhao_yc' }, team: 'ludou-fe',
    tags: ['docs', 'mdx'], safety: 'warn', evalScore: 72, langs: ['TS'],
  },
  {
    slug: 'ludou-release',
    name: 'Skill · ludou-release',
    short: '麓豆内部统一发布流程脚本,包含 changelog、tag、灰度脚本。',
    cat: 'devops', icon: 'L',
    installs: 320, stars: 0, score: 0, version: '4.6.2',
    updated: '2026-05-15', visibility: 'TEAM_PRIVATE', status: 'APPROVED',
    author: { name: '吴嘉禾', handle: 'wu_jh' }, team: 'ludou-fe',
    tags: ['内部', 'release'], safety: 'pass', evalScore: 90, langs: ['Sh'],
  },
  {
    slug: 'qa-snap',
    name: 'Skill · qa-snap',
    short: '为内部业务页生成视觉回归基线,与 CI 集成。',
    cat: 'devops', icon: 'Q',
    installs: 180, stars: 0, score: 0, version: '0.5.1',
    updated: '2026-05-11', visibility: 'TEAM_PRIVATE', status: 'APPROVED',
    author: { name: '陈奕笑', handle: 'chen_yx' }, team: 'ludou-fe',
    tags: ['内部', 'visual'], safety: 'pass', evalScore: 76, langs: ['TS'],
  },
];
