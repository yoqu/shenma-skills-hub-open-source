import type { Visibility } from '@/mocks/skills';

export type { SkillParseResult, SkillParseCheck } from '@/api/endpoints';

/** Shape of the in-progress create-skill form. */
export interface SkillMeta {
  name: string;
  slug: string;
  version: string;
  description: string;
  /** 长篇 Markdown 介绍（可含图片） */
  descriptionMd: string;
  tags: string[];
  category: string;
  visibility: Visibility;
  team: string;
  /** 自定义上传图标 storage key（提交用） */
  iconKey?: string;
  /** 自定义上传图标完整 URL（预览用） */
  iconUrl?: string;
}

export type UploadKind = 'zip' | 'md' | 'text';

/** Result of uploading SKILL.zip / SKILL.md / pasted text. 后端三种入口都会合成 zip。 */
export interface UploadInfo {
  kind: UploadKind;
  /** 展示用文件名(粘贴模式下是 "SKILL.md"). */
  fileName: string;
  /** zip / md / text 原始大小. */
  size: number;
  /** Storage key returned by backend, will be passed to create/saveDraft as zipUrl. */
  zipUrl: string;
  url?: string;
}
