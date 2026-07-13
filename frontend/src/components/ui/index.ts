// 共享设计系统（唯一来源）
export * from '@skillstack/ui';

// app 耦合组件保留在 frontend
export { AvatarUpload } from './AvatarUpload';
export type { AvatarUploadProps } from './AvatarUpload';
export { IconUpload } from './IconUpload';
export type { IconUploadProps } from './IconUpload';
export { PromptCard } from '../atoms/PromptCard';
export type { PromptCardProps } from '../atoms/PromptCard';
