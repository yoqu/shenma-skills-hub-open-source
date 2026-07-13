import type { Visibility } from './skills';

export interface Suite {
  id: string;
  name: string;
  slug: string;
  desc: string;
  visibility: Visibility;
  skills: number;
  installs: number;
  updated: string;
}

export const SUITES: Suite[] = [
  {
    id: 's1', name: '新人上手套件', slug: 'onboard',
    desc: '新成员入组第一周需要安装的工具集。',
    visibility: 'TEAM_PRIVATE', skills: 6, installs: 24, updated: '2026-05-10',
  },
  {
    id: 's2', name: '前端日常开发', slug: 'daily-fe',
    desc: '本地开发、调试、Mock、格式化、Lint 一键就绪。',
    visibility: 'TEAM_PRIVATE', skills: 8, installs: 42, updated: '2026-05-04',
  },
  {
    id: 's3', name: '发布与运维', slug: 'release-ops',
    desc: '从打 tag、changelog 到灰度脚本的发布闭环。',
    visibility: 'TEAM_PRIVATE', skills: 4, installs: 11, updated: '2026-04-28',
  },
  {
    id: 's4', name: '麓豆开源精选', slug: 'open-source',
    desc: '团队对外开源的核心 Skill,推荐组合安装。',
    visibility: 'PUBLIC', skills: 5, installs: 1820, updated: '2026-05-12',
  },
];

/** Skill slugs currently selected by the suite editor's "已选" panel. */
export const SUITE_SELECTED: string[] = [
  'mono-format', 'api-mock', 'env-doctor', 'i18n-extract', 'doc-gen', 'lint-bundle',
];
