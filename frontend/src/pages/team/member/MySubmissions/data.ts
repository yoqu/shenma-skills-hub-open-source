import type { ComponentType } from 'react';
import { I, type IconProps } from '@/components/icons';
import type { Visibility, SafetyLevel } from '@/mocks/skills';

export type SubmissionStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type CommentKind =
  | 'system'
  | 'review'
  | 'mine'
  | 'approval'
  | 'change-request';

export interface CommentAuthor {
  name: string;
  role: string;
  avatar: string;
  /** 头像图片 URL（上传 / 飞书 SSO）。无图时使用 `avatar` 字符占位。 */
  avatarUrl?: string;
}

export interface CommentFileRef {
  path: string;
  line: number;
  snippet: string;
}

export interface SubmissionComment {
  id: string;
  kind: CommentKind;
  ts: string;
  body: string;
  unread?: boolean;
  author?: CommentAuthor;
  fileRef?: CommentFileRef;
}

export interface Submission {
  id: string;
  /** review 行 PK；用于 withdraw / resubmit 等 mutation */
  rowId?: number;
  /** 关联 skill 主键；用于"发新版本"等 mutation */
  skillId?: number;
  /** 关联 prompt 主键；Prompt review 已 approve 后会回填 */
  promptId?: number;
  /** SKILL / PROMPT — 用于卡片样式与"重新提交"跳转链路 */
  targetType: 'SKILL' | 'PROMPT';
  name: string;
  version: string;
  submittedAt: string;
  visibility: Visibility;
  short: string;
  files: number;
  safety: SafetyLevel;
  evalScore: number;
  status: SubmissionStatus;
  reviewer: string;
  position?: number;
  approvedAt?: string;
  feedback?: string;
  /** 作者提交时填写的版本变更说明（SKILL-VER-001） */
  changelog?: string;
  unread: number;
  comments: SubmissionComment[];
}

export type StatusTone = 'warning' | 'success' | 'danger' | 'neutral';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  ico: ComponentType<IconProps>;
}

export const STATUS_MAP: Record<SubmissionStatus, StatusMeta> = {
  DRAFT: { label: '草稿', tone: 'neutral', ico: I.clock },
  PENDING_REVIEW: { label: '审核中', tone: 'warning', ico: I.clock },
  APPROVED: { label: '已通过', tone: 'success', ico: I.check },
  CHANGES_REQUESTED: { label: '需改动', tone: 'danger', ico: I.x },
  REJECTED: { label: '已拒绝', tone: 'danger', ico: I.x },
  WITHDRAWN: { label: '已撤回', tone: 'neutral', ico: I.x },
};
