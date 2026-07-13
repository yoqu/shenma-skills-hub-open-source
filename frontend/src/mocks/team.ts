export type TeamRole = 'Owner' | 'Admin' | 'Member' | 'Viewer';

export interface Team {
  id?: number;
  slug: string;
  name: string;
  desc: string;
  members: number;
  publicSkills: number;
  privateSkills: number;
  suites: number;
  avatar: string;
  logoUrl?: string;
  color: string;
  reviewMode?: 'REVIEW_REQUIRED' | 'DIRECT_PUBLISH';
  publicHome?: boolean;
  /** 团队创建时间（后端 ISO 8601 字符串，例：2024-08-12T09:30:00）。 */
  createdAt?: string;
}

export interface User {
  handle: string;
  name: string;
  role: TeamRole;
  avatar: string;
  /** 头像图片 URL（上传后后端返回的可访问地址）。无图时使用 `avatar` 字符占位。 */
  avatarUrl?: string;
  email: string;
  phone: string;
  joinedDays: number;
  /** 平台级角色（后端 Phase A 起新增；旧 mock 数据视为 USER）。 */
  platformRole?: 'USER' | 'SUPER_ADMIN';
  /** 账户状态（后端 Phase A 起新增）。 */
  accountStatus?: 'ACTIVE' | 'DISABLED';
}

export interface TeamMember {
  handle: string;
  name: string;
  role: TeamRole;
  joined: string;
  skills: number;
  lastActive: string;
  avatar: string;
  /** 头像图片 URL（上传 / 飞书 SSO）。无图时使用 `avatar` 字符占位。 */
  avatarUrl?: string;
}

export interface MyTeam {
  id: string;
  slug: string;
  name: string;
  avatar: string;
  logoUrl?: string;
  color: string;
  role: TeamRole;
  members: number;
  unread: number;
}

export const TEAM: Team = {
  slug: 'ludou-fe',
  name: '麓豆前端组',
  desc: '负责麓豆产品线的前端基础建设、组件库与开发者工具。对内沉淀工程化 Skill,对外开源通用能力。',
  members: 18,
  publicSkills: 14,
  privateSkills: 9,
  suites: 4,
  avatar: '麓',
  color: '#4F46E5',
};

export const ME: User = {
  handle: 'zhao_yc',
  name: '赵一辰',
  role: 'Admin',
  avatar: '赵',
  email: 'zhao.yc@ludou.test',
  phone: '138****2046',
  joinedDays: 184,
};

export const TEAM_MEMBERS: TeamMember[] = [
  { handle: 'lin_zr', name: '林子睿', role: 'Owner', joined: '2023-08-12', skills: 12, lastActive: '2 分钟前', avatar: '林' },
  { handle: 'zhao_yc', name: '赵一辰', role: 'Admin', joined: '2023-09-04', skills: 9, lastActive: '刚刚', avatar: '赵' },
  { handle: 'wu_jh', name: '吴嘉禾', role: 'Admin', joined: '2023-11-21', skills: 7, lastActive: '1 小时前', avatar: '吴' },
  { handle: 'chen_yx', name: '陈奕笑', role: 'Member', joined: '2024-01-08', skills: 4, lastActive: '今天 10:24', avatar: '陈' },
  { handle: 'huang_t', name: '黄  桃', role: 'Member', joined: '2024-03-17', skills: 3, lastActive: '昨天', avatar: '黄' },
  { handle: 'sun_lw', name: '孙临舞', role: 'Member', joined: '2024-05-02', skills: 2, lastActive: '3 天前', avatar: '孙' },
  { handle: 'pan_dq', name: '潘鼎清', role: 'Member', joined: '2024-09-14', skills: 1, lastActive: '昨天', avatar: '潘' },
  { handle: 'mo_jr', name: '莫俊然', role: 'Member', joined: '2025-01-22', skills: 0, lastActive: '7 天前', avatar: '莫' },
];

export const MY_TEAMS: MyTeam[] = [
  { id: 'ludou-fe', slug: 'ludou-fe', name: '麓豆前端组', avatar: '麓', color: '#4F46E5', role: 'Admin', members: 18, unread: 3 },
  { id: 'ludou-be', slug: 'ludou-be', name: '麓豆后端组', avatar: '麓', color: '#0EA5E9', role: 'Member', members: 22, unread: 0 },
  { id: 'growth', slug: 'growth', name: '增长数据小组', avatar: '增', color: '#10B981', role: 'Member', members: 9, unread: 1 },
  { id: 'design', slug: 'design', name: '产品设计组', avatar: '设', color: '#F59E0B', role: 'Viewer', members: 6, unread: 0 },
];
