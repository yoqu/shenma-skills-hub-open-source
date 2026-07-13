import type { ReactNode } from 'react';
import type { IconProps } from '@/components/icons';

export interface SkillVersion {
  /** SkillVersion 行 PK，前端列表 key */
  id?: number;
  version: string;
  date: string;
  /** changelog 第一行预览 */
  note: string;
  /** changelog 全文，展开时显示 */
  changelog?: string;
  author: string;
  installs: number;
  latest?: boolean;
  filesCount?: number;
  /** pass / warn / fail */
  safety?: 'pass' | 'warn' | 'fail';
  evalScore?: number;
}

export interface InstallTab {
  id: 'chat' | 'cli' | 'zip';
  label: string;
  icon: (p: IconProps) => ReactNode;
}
