export interface RegisterState {
  phone: string;
  inviteCode: string;
  joinMode: 'invite' | 'none';
  agree: boolean;
  code: string[];
  name: string;
  handle: string;
  email: string;
  password: string;
  passwordConfirm: string;
  avatarColor: string;
}

export const AVATAR_COLORS = [
  '#4F46E5',
  '#EC4899',
  '#14B8A6',
  '#F59E0B',
  '#0EA5E9',
  '#8B5CF6',
] as const;
