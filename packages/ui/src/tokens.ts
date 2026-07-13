/**
 * Design tokens — JS variant from docs/design-ui/data.jsx.
 *
 * These are the literal color values the prototype renders with via inline
 * `style`. Components should prefer reading from here (or the matching Tailwind
 * utilities) over hand-typing hex values.
 */
export const TOKENS = {
  primary: '#4F46E5',
  primarySoft: '#EEF2FF',
  primaryDeep: '#3730A3',
  text: '#0F172A',
  text2: '#475569',
  text3: '#94A3B8',
  border: '#E2E8F0',
  borderSoft: '#EEF0F4',
  bg: '#FFFFFF',
  bgAlt: '#F8FAFC',
  bgGray: '#F1F5F9',
  success: '#10B981',
  successSoft: '#ECFDF5',
  successDeep: '#065F46',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  info: '#0EA5E9',
} as const;

export type Tokens = typeof TOKENS;

export interface Category {
  id: string;
  name: string;
  count: number;
}

export const CATEGORIES: Category[] = [
  { id: 'all', name: '全部', count: 248 },
  { id: 'dev', name: '开发工具', count: 86 },
  { id: 'data', name: '数据处理', count: 54 },
  { id: 'design', name: '设计协作', count: 32 },
  { id: 'doc', name: '文档生成', count: 28 },
  { id: 'devops', name: '运维', count: 24 },
  { id: 'ai', name: 'AI 增强', count: 24 },
];
