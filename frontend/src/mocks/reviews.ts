import type { SafetyLevel, Visibility } from './skills';

export type ReviewStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED'
  | 'WITHDRAWN';

export interface ReviewSubmitter {
  name: string;
  handle: string;
  avatar: string;
  /** 头像图片 URL（上传 / 飞书 SSO）。无图时使用 `avatar` 字符占位。 */
  avatarUrl?: string;
}

export interface Review {
  id: string;
  targetType?: 'SKILL' | 'PROMPT';
  targetId?: number;
  slug: string;
  name: string;
  submittedBy: ReviewSubmitter;
  submittedAt: string;
  visibility: Visibility;
  short: string;
  files: number;
  version: string;
  safety: SafetyLevel;
  evalScore: number;
  status: ReviewStatus;
  reason?: string;
  /** 作者填写的本次版本变更说明（非空 ≈ 发新版本审核，SKILL-VER-001） */
  changelog?: string;
  /** CREATE / VERSION_BUMP */
  kind?: string;
  catCode?: string;
  tagsJson?: string;
  payloadJson?: string;
}

export const REVIEWS: Review[] = [
  {
    id: 'r-1042', slug: 'graphql-codegen', name: 'Skill · graphql-codegen',
    submittedBy: { name: '陈奕笑', handle: 'chen_yx', avatar: '陈' },
    submittedAt: '今天 09:14', visibility: 'TEAM_PRIVATE',
    short: '根据 schema.graphql 自动生成前端 hooks 与类型。',
    files: 12, version: '0.1.0', safety: 'pass', evalScore: 81,
    status: 'PENDING_REVIEW',
  },
  {
    id: 'r-1041', slug: 'lint-bundle', name: 'Skill · lint-bundle',
    submittedBy: { name: '黄  桃', handle: 'huang_t', avatar: '黄' },
    submittedAt: '今天 08:02', visibility: 'PUBLIC',
    short: '麓豆前端统一 ESLint + Stylelint 规则集合。',
    files: 4, version: '1.0.0', safety: 'pass', evalScore: 88,
    status: 'PENDING_REVIEW',
  },
  {
    id: 'r-1039', slug: 'release-notes', name: 'Skill · release-notes',
    submittedBy: { name: '潘鼎清', handle: 'pan_dq', avatar: '潘' },
    submittedAt: '昨天 18:41', visibility: 'PUBLIC',
    short: '从 Git commit 自动整理 release notes。',
    files: 6, version: '0.3.2', safety: 'warn', evalScore: 64,
    status: 'PENDING_REVIEW',
  },
  {
    id: 'r-1037', slug: 'mock-cookies', name: 'Skill · mock-cookies',
    submittedBy: { name: '孙临舞', handle: 'sun_lw', avatar: '孙' },
    submittedAt: '2 天前', visibility: 'PUBLIC',
    short: '调试用临时 Cookie / Session 注入器。',
    files: 3, version: '0.1.0', safety: 'fail', evalScore: 41,
    status: 'REJECTED',
    reason: '包含直接读取浏览器 Cookie 的代码,未做权限说明,请补充安全声明后重新提交。',
  },
];
